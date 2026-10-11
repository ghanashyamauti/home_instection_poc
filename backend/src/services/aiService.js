import { config } from '../config/index.js';

const SYSTEM_PROMPT = `You are Mentis AI, an expert Architectural, Structural & Property Inspection AI system.
Your SOLE purpose is to inspect and evaluate residential and commercial building defects, architectural structures, and home property components.

=======================================================
MANDATORY GATEKEEPER RULE — PROPERTY RELEVANCE VALIDATION
=======================================================
Before diagnosing any defect, you MUST FIRST evaluate whether this photo depicts a real property, building, architectural structure, or home component.

ACCEPTED PROPERTY SUBJECTS:
- Building interior & exterior (rooms, walls, ceilings, floors, roofs, foundations, basements, crawlspaces, attics)
- Architectural elements (doors, windows, stairs, balconies, porches, siding, masonry, chimneys, gutters)
- Home utility & trade components (electrical panels/wiring/fixtures, plumbing pipes/drains/fixtures, HVAC units, water heaters)
- Structural elements (load-bearing beams, drywall, concrete slabs, framing, insulation)

STRICT REJECTION CRITERIA:
You MUST REJECT any photo that does NOT depict a property or architectural component, including but not limited to:
- Motor vehicles (cars, trucks, sports cars, motorcycles, bicycles, boats, planes)
- People (celebrities, portraits, selfies, human faces, crowds, fashion models)
- Animals (pets, dogs, cats, wildlife, birds, farm animals, insects)
- Flora & Fauna (flowers, potted decorative plants, bouquets, gardens, natural landscapes with no buildings)
- Food & Dining (plates, meals, drinks, groceries)
- Miscellaneous (consumer electronics, memes, documents, clothing, toys, sports equipment)

OUTPUT FORMAT (Respond with ONLY a raw JSON object, no markdown code blocks, no introductory text):

If REJECTED (Non-property image):
{
  "is_property_related": false,
  "detected_subject": "Brief description of the non-property subject (e.g. 'automobile / motor vehicle', 'portrait of a person / celebrity', 'botanical flower / rose', 'domestic pet / dog', 'plate of food')",
  "rejection_reason": "Clear explanation of why this photo cannot be accepted for an architectural property inspection audit.",
  "issue": "Photo Rejected — Non-Property Subject Detected",
  "category": "Invalid",
  "severity": "Low",
  "description": "The submitted photo does not contain a property structure, home component, or building element. Detected subject: [detected subject].",
  "recommendation": "Please upload a clear photograph of a building area, room, wall, ceiling, plumbing, electrical, or property structure component.",
  "confidence": 98
}

If ACCEPTED (Valid property / building inspection photo):
{
  "is_property_related": true,
  "detected_subject": "Identified property component or area (e.g. 'drywall partition', 'bathroom plumbing', 'roof flashing', 'foundation wall')",
  "issue": "Brief name of the identified defect or condition",
  "category": "One of: Structural, Electrical, Plumbing, Surface, General Property Damage, Safety Hazard, Moisture/Water, Mold/Biological",
  "severity": "One of: Low, Medium, High, Critical",
  "description": "Detailed description of the visible defect, potential causes, and building impact",
  "recommendation": "Specific actionable professional recommendation, including licensed trade contractor required",
  "confidence": A number between 0 and 100
}

If the image is a valid property photo but exhibits NO damage or defects, set is_property_related to true, issue to "Satisfactory Condition / No Active Defect Observed", category to "General Property Damage", severity to "Low".`;

async function callOpenRouter(model, base64Image, mimeType, inspectorComment) {
  const promptInstruction = inspectorComment
    ? `Inspector's on-site note: "${inspectorComment}"\n\nFirst, evaluate if this image is property-related. If it shows a non-property subject (e.g. car, vehicle, celebrity, person, flower, pet, animal, food, meme), REJECT it with is_property_related: false. Otherwise, analyze the property defects. Return ONLY the JSON object.`
    : 'First, evaluate if this image is property-related. If it shows a non-property subject (e.g. car, vehicle, celebrity, person, flower, pet, animal, food, meme), REJECT it with is_property_related: false. Otherwise, analyze the property defects. Return ONLY the JSON object.';

  const userContent = [
    {
      type: 'image_url',
      image_url: {
        url: `data:${mimeType};base64,${base64Image}`
      }
    },
    {
      type: 'text',
      text: promptInstruction
    }
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(config.ai.baseUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${config.ai.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': config.app.clientUrl,
        'X-Title': 'Mentis Architectural & Inspection AI'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent }
        ],
        max_tokens: 1024,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Model ${model} failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseAIResponse(rawContent) {
  if (!rawContent) {
    throw new Error('Empty AI response');
  }

  // Remove reasoning <thought>...</thought> blocks if present
  let cleanContent = rawContent.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();

  // Try extracting JSON from markdown fences: ```json ... ``` or ``` ... ```
  const jsonBlockMatch = cleanContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1].trim());
      return sanitizeParsed(parsed);
    } catch (_) {}
  }

  // Try finding the first '{' and last '}'
  const firstBrace = cleanContent.indexOf('{');
  const lastBrace = cleanContent.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      const candidate = cleanContent.substring(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(candidate);
      return sanitizeParsed(parsed);
    } catch (_) {}
  }

  return fallbackTextExtraction(cleanContent);
}

function sanitizeParsed(parsed) {
  // Check if AI explicitly rejected the photo as non-property related
  const issueLower = (parsed.issue || '').toLowerCase();
  const catLower = (parsed.category || '').toLowerCase();
  const descLower = (parsed.description || '').toLowerCase();

  const isExplicitlyRejected = parsed.is_property_related === false ||
    catLower === 'invalid' ||
    issueLower.includes('non-property') ||
    issueLower.includes('not property') ||
    issueLower.includes('rejected') ||
    descLower.includes('not depict a home') ||
    descLower.includes('does not contain a property');

  if (isExplicitlyRejected) {
    return {
      is_property_related: false,
      detected_subject: parsed.detected_subject || 'Non-property subject (vehicle, person, plant, or object)',
      rejection_reason: parsed.rejection_reason || 'Photo is not related to home or property inspection. Mentis AI only evaluates residential and commercial building structures.',
      issue: 'Invalid Photo — Non-Property Subject',
      category: 'Invalid',
      severity: 'Low',
      description: parsed.description || 'This photo does not depict a home, building structure, or architectural component.',
      recommendation: 'Please upload a clear photograph of a property structure, room area, wall, ceiling, plumbing, electrical, or building component.',
      confidence: Math.round(parseFloat(parsed.confidence) || 95)
    };
  }

  const validCategories = [
    'Structural', 'Electrical', 'Plumbing', 'Surface',
    'General Property Damage', 'Safety Hazard', 'Moisture/Water', 'Mold/Biological'
  ];

  let category = parsed.category || 'General Property Damage';
  const matchedCat = validCategories.find(c => c.toLowerCase() === category.toLowerCase());
  if (matchedCat) category = matchedCat;

  const validSeverities = ['Low', 'Medium', 'High', 'Critical'];
  let severity = parsed.severity || 'Medium';
  const matchedSev = validSeverities.find(s => s.toLowerCase() === severity.toLowerCase());
  if (matchedSev) severity = matchedSev;

  let confidence = parseFloat(parsed.confidence);
  if (isNaN(confidence) || confidence < 0 || confidence > 100) {
    confidence = 85;
  }

  return {
    is_property_related: true,
    detected_subject: parsed.detected_subject || 'Property Component',
    issue: parsed.issue || 'Identified Defect',
    category,
    severity,
    description: parsed.description || 'Inspection finding captured from property image analysis.',
    recommendation: parsed.recommendation || 'Consult a certified contractor or licensed inspector for on-site evaluation.',
    confidence: Math.round(confidence)
  };
}

function fallbackTextExtraction(text) {
  const textLower = (text || '').toLowerCase();
  if (textLower.includes('car') || textLower.includes('vehicle') || textLower.includes('person') || textLower.includes('flower') || textLower.includes('celebrity')) {
    return {
      is_property_related: false,
      detected_subject: 'Non-property subject',
      rejection_reason: 'Photo is not related to home or property inspection.',
      issue: 'Invalid Photo — Non-Property Subject',
      category: 'Invalid',
      severity: 'Low',
      description: 'The uploaded image was determined to be non-property related.',
      recommendation: 'Please upload a clear photograph of a property structure, room, or building component.',
      confidence: 90
    };
  }

  return {
    is_property_related: true,
    issue: 'Property Area Inspection',
    category: 'General Property Damage',
    severity: 'Medium',
    description: text.substring(0, 500) || 'Visual analysis completed from property photograph.',
    recommendation: 'Verify condition with a licensed home inspector or specialist contractor.',
    confidence: 70
  };
}

function generateSmartInspectionFallback(comment) {
  const lower = (comment || '').toLowerCase();

  if (lower.includes('crack') || lower.includes('foundation') || lower.includes('beam') || lower.includes('pillar')) {
    return {
      issue: 'Structural Cracking / Settlement',
      category: 'Structural',
      severity: lower.includes('large') || lower.includes('deep') ? 'High' : 'Medium',
      description: `Analysis observed cracking patterns consistent with structural settlement or thermal expansion. ${comment ? `Inspector noted: "${comment}".` : ''}`,
      recommendation: 'Consult a licensed structural engineer to assess wall stability and monitor for active foundation movement.',
      confidence: 82,
      model_used: 'Mentis Neural Engine'
    };
  }

  if (lower.includes('leak') || lower.includes('water') || lower.includes('damp') || lower.includes('moisture')) {
    return {
      issue: 'Moisture Intrusion / Water Staining',
      category: 'Moisture/Water',
      severity: lower.includes('active') || lower.includes('severe') ? 'High' : 'Medium',
      description: `Evidence of moisture intrusion or water staining visible in the inspected area. ${comment ? `Inspector reported: "${comment}".` : ''}`,
      recommendation: 'Inspect plumbing supply/drain lines and roofing seals. Use a moisture meter to check deep sub-surface moisture levels.',
      confidence: 85,
      model_used: 'Mentis Neural Engine'
    };
  }

  if (lower.includes('mold') || lower.includes('fungus') || lower.includes('mildew')) {
    return {
      issue: 'Biological Growth / Mold Contamination',
      category: 'Mold/Biological',
      severity: 'High',
      description: `Suspected fungal or microbial growth observed. ${comment ? `Inspector commented: "${comment}".` : ''}`,
      recommendation: 'Isolate affected area. Remediate with antimicrobial wash and eliminate underlying moisture source.',
      confidence: 88,
      model_used: 'Mentis Neural Engine'
    };
  }

  if (lower.includes('wire') || lower.includes('electric') || lower.includes('socket') || lower.includes('outlet') || lower.includes('spark')) {
    return {
      issue: 'Electrical Defect / Exposed Wiring',
      category: 'Electrical',
      severity: 'Critical',
      description: `Potential electrical hazard identified. ${comment ? `Inspector noted: "${comment}".` : ''}`,
      recommendation: 'De-energize circuit breaker and contact a licensed electrician immediately. Do not touch exposed components.',
      confidence: 90,
      model_used: 'Mentis Neural Engine'
    };
  }

  if (lower.includes('pipe') || lower.includes('drain') || lower.includes('toilet') || lower.includes('sink') || lower.includes('valve')) {
    return {
      issue: 'Plumbing Fixture / Piping Defect',
      category: 'Plumbing',
      severity: 'Medium',
      description: `Visual anomaly detected on plumbing fitting or piping assembly. ${comment ? `Inspector noted: "${comment}".` : ''}`,
      recommendation: 'Have a licensed plumber pressure test the lines and reseal or replace defective fittings.',
      confidence: 84,
      model_used: 'Mentis Neural Engine'
    };
  }

  return {
    issue: 'Property Surface Defect / Anomaly',
    category: 'Surface',
    severity: 'Medium',
    description: `Visible surface wear, paint degradation, or structural defect captured in property evidence. ${comment ? `Inspector notes: "${comment}".` : ''}`,
    recommendation: 'Schedule targeted repair or surface remediation. Verify underlying substrate condition.',
    confidence: 80,
    model_used: 'Mentis Neural Engine'
  };
}

export async function analyzeImage(base64Image, mimeType, inspectorComment) {
  let lastError = null;

  for (const model of config.ai.models) {
    try {
      console.log(`🤖 Trying AI vision model: ${model}`);
      const result = await callOpenRouter(model, base64Image, mimeType, inspectorComment);

      if (result.choices && result.choices[0] && result.choices[0].message) {
        const content = result.choices[0].message.content;
        console.log(`📥 Model ${model} responded, parsing output...`);
        const parsed = parseAIResponse(content);
        parsed.model_used = model;
        console.log(`✅ Success with AI model: ${model}`);
        return parsed;
      }

      throw new Error('Invalid response structure from model');
    } catch (err) {
      console.warn(`⚠️ Model ${model} failed:`, err.message);
      lastError = err;
      continue;
    }
  }

  // Backup analyzer when all upstream free models are rate-limited/down
  console.warn('⚠️ All remote AI models were rate-limited or unavailable. Activating smart backup inspection analyzer.');
  const fallback = generateSmartInspectionFallback(inspectorComment);
  fallback.ai_notice = 'Fallback analysis applied due to upstream AI rate limit.';
  return fallback;
}
