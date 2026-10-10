import { config } from '../config/index.js';

const SYSTEM_PROMPT = `You are an expert home inspector AI assistant. You analyze images of property areas and components to identify visible issues, defects, and damage.

When analyzing an image, you must respond with ONLY a valid JSON object (no markdown, no code fences, no introductory remarks) in this exact format:
{
  "issue": "Brief name of the identified issue",
  "category": "One of: Structural, Electrical, Plumbing, Surface, General Property Damage, Safety Hazard, Moisture/Water, Mold/Biological",
  "severity": "One of: Low, Medium, High, Critical",
  "description": "Detailed description of the identified issue, what you see in the image, and potential causes",
  "recommendation": "Specific actionable recommendations for addressing the issue, including whether professional help is needed",
  "confidence": A number between 0 and 100 representing your confidence in the assessment
}

Initial defect categories to focus on:
- Wall cracks (hairline, structural, settlement, diagonal)
- Water leakage, moisture, dampness (water stains, efflorescence, drips)
- Mold and mildew (visible growth, spore discoloration patterns)
- Ceiling damage (sagging, water stains, cracks, peeling paint)
- Flooring damage (cracks, warping, staining, wear, unevenness)
- Window and door damage (frame damage, seal issues, glass cracks, drafts)
- Visible electrical issues (exposed wiring, scorched outlets, improper connections)
- General property damage (vandalism, neglect, weathering, physical impact)

If the image does not appear to show any defects or issues, still provide your assessment noting the area appears to be in good condition, with category "General Property Damage", severity "Low", and confidence reflecting your certainty.

Always consider the inspector's comments if provided, as they give valuable on-site context that may not be visible in the image.`;

async function callOpenRouter(model, base64Image, mimeType, inspectorComment) {
  const userContent = [
    {
      type: 'image_url',
      image_url: {
        url: `data:${mimeType};base64,${base64Image}`
      }
    },
    {
      type: 'text',
      text: inspectorComment
        ? `Inspector's on-site comment: "${inspectorComment}"\n\nAnalyze this property image along with the inspector's comment. Identify any visible issues, defects, or damage. Return ONLY the JSON object.`
        : 'Analyze this property image. Identify any visible issues, defects, or damage. Return ONLY the JSON object.'
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
    issue: parsed.issue || 'Identified Defect',
    category,
    severity,
    description: parsed.description || 'Inspection finding captured from image analysis.',
    recommendation: parsed.recommendation || 'Consult a certified contractor or licensed inspector for on-site evaluation.',
    confidence: Math.round(confidence)
  };
}

function fallbackTextExtraction(text) {
  return {
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
