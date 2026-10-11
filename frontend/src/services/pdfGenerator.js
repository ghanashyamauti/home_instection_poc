import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Normalizes any image source into a clean, jsPDF-compatible JPEG Data URL.
 * Handles:
 * - Local FileReader data URLs (data:image/...)
 * - Raw database base64 strings (with or without data: prefix)
 * - Server relative URLs (/uploads/...)
 * - Converts PNG/WEBP to standard JPEG via HTML5 Canvas to prevent jsPDF format exceptions
 */
function resolveSingleImage(rawSrc) {
  return new Promise((resolve) => {
    if (!rawSrc) {
      resolve(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = setTimeout(() => {
      if (typeof rawSrc === 'string' && rawSrc.startsWith('data:image')) {
        resolve({ dataUrl: rawSrc, format: rawSrc.includes('png') ? 'PNG' : 'JPEG' });
      } else {
        resolve(null);
      }
    }, 4500);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 800;
        canvas.height = img.naturalHeight || img.height || 600;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.88);
        resolve({ dataUrl: jpegDataUrl, format: 'JPEG' });
      } catch (err) {
        if (typeof rawSrc === 'string' && rawSrc.startsWith('data:image')) {
          resolve({ dataUrl: rawSrc, format: rawSrc.includes('png') ? 'PNG' : 'JPEG' });
        } else {
          resolve(null);
        }
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      if (typeof rawSrc === 'string' && rawSrc.startsWith('data:image')) {
        resolve({ dataUrl: rawSrc, format: rawSrc.includes('png') ? 'PNG' : 'JPEG' });
      } else {
        resolve(null);
      }
    };

    img.src = rawSrc;
  });
}

// Brand Logo Cache
let cachedMentisLogoDataUrl = null;
async function getMentisLogo() {
  if (cachedMentisLogoDataUrl) return cachedMentisLogoDataUrl;
  try {
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    const fullLogoUrl = origin ? `${origin}/mentis-logo.png` : '/mentis-logo.png';
    const res = await resolveSingleImage(fullLogoUrl);
    if (res && res.dataUrl) {
      cachedMentisLogoDataUrl = res.dataUrl;
    }
  } catch (_) {}
  return cachedMentisLogoDataUrl;
}


function resolveImageDataUrl(finding) {
  let rawSrc = null;

  if (finding.preview && typeof finding.preview === 'string') {
    rawSrc = finding.preview;
  } else if (finding.image_data && typeof finding.image_data === 'string') {
    if (finding.image_data.startsWith('data:image')) {
      rawSrc = finding.image_data;
    } else {
      const mime = finding.image_mime_type || 'image/jpeg';
      rawSrc = `data:${mime};base64,${finding.image_data}`;
    }
  } else if (finding.image_url && typeof finding.image_url === 'string') {
    if (finding.image_url.startsWith('data:image')) {
      rawSrc = finding.image_url;
    } else if (finding.image_url.startsWith('http')) {
      rawSrc = finding.image_url;
    } else {
      rawSrc = `${window.location.origin}${finding.image_url.startsWith('/') ? '' : '/'}${finding.image_url}`;
    }
  }

  return resolveSingleImage(rawSrc);
}

function resolveAnnotatedImageDataUrl(finding) {
  let rawSrc = null;

  if (finding.annotated_preview && typeof finding.annotated_preview === 'string') {
    rawSrc = finding.annotated_preview;
  } else if (finding.annotated_image_data && typeof finding.annotated_image_data === 'string') {
    if (finding.annotated_image_data.startsWith('data:image')) {
      rawSrc = finding.annotated_image_data;
    } else {
      rawSrc = `data:image/jpeg;base64,${finding.annotated_image_data}`;
    }
  } else if (finding.annotated_image_url && typeof finding.annotated_image_url === 'string') {
    if (finding.annotated_image_url.startsWith('data:image')) {
      rawSrc = finding.annotated_image_url;
    } else if (finding.annotated_image_url.startsWith('http')) {
      rawSrc = finding.annotated_image_url;
    } else {
      rawSrc = `${window.location.origin}${finding.annotated_image_url.startsWith('/') ? '' : '/'}${finding.annotated_image_url}`;
    }
  }

  return resolveSingleImage(rawSrc);
}

export async function generatePdfReport(inspection) {
  const doc = new jsPDF();
  const findings = inspection.findings || [];
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomMargin = 20;
  const maxUsableY = pageHeight - bottomMargin;

  // Colors - Florentine Gold & Espresso Bronze Luxury
  const primaryColor = [180, 131, 62]; // Brushed Antique Gold (#b4833e)
  const darkColor = [28, 25, 23];      // Espresso Bronze (#1c1917)
  const grayColor = [120, 113, 108];   // Warm Taupe Stone (#78716c)
  const borderGray = [226, 232, 240];

  // Pre-resolve brand logo and all image evidence in parallel
  const [logoDataUrl, resolvedPairs] = await Promise.all([
    getMentisLogo(),
    Promise.all(
      findings.map(async (f) => {
        const original = await resolveImageDataUrl(f);
        const annotated = await resolveAnnotatedImageDataUrl(f);
        return { original, annotated };
      })
    )
  ]);

  // ===== HEADER WITH OFFICIAL MENTIS LOGO =====
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 42, 'F');

  let textX = 14;
  if (logoDataUrl) {
    try {
      const imgFmt = logoDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(logoDataUrl, imgFmt, 14, 7, 28, 28);
      textX = 46;
    } catch (_) {}
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('MENTIS', textX, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Architectural & Property Inspection AI', textX, 25);

  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, textX, 32);

  // Single Defect vs Multi-Photo Batch Indicator
  if (findings.length === 1) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('SINGLE DEFECT AUDIT', pageWidth - 14, 22, { align: 'right' });
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`MULTI-PHOTO BATCH AUDIT (${findings.length} DEFECTS)`, pageWidth - 14, 22, { align: 'right' });
  }

  // ===== INSPECTION INFO =====
  let y = 52;

  doc.setTextColor(...darkColor);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  const safeTitle = inspection.title || (findings.length === 1 ? 'Single Defect Inspection Report' : 'Complete Property Inspection Audit');
  doc.text(safeTitle, 14, y);
  y += 9;

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);

  if (inspection.property_address) {
    doc.text(`Property Address: ${inspection.property_address}`, 14, y);
    y += 5.5;
  }
  if (inspection.client_name) {
    doc.text(`Client: ${inspection.client_name}`, 14, y);
    y += 5.5;
  }
  if (inspection.property_type) {
    doc.text(`Property Type: ${inspection.property_type}`, 14, y);
    y += 5.5;
  }
  doc.text(`Date: ${new Date(inspection.created_at || Date.now()).toLocaleDateString()}`, 14, y);
  y += 5.5;
  doc.text(`Total Documented Findings: ${findings.length}`, 14, y);
  y += 10;

  // ===== SEVERITY SUMMARY TABLE =====
  const severityCounts = {
    Critical: findings.filter(f => f.ai_severity === 'Critical').length,
    High: findings.filter(f => f.ai_severity === 'High').length,
    Medium: findings.filter(f => f.ai_severity === 'Medium').length,
    Low: findings.filter(f => f.ai_severity === 'Low').length
  };

  doc.setTextColor(...darkColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Severity Risk Breakdown', 14, y);
  y += 6;

  const summaryData = [
    ['Critical', String(severityCounts.Critical), severityCounts.Critical > 0 ? 'Immediate mitigation required' : '-'],
    ['High', String(severityCounts.High), severityCounts.High > 0 ? 'Needs prompt attention & repair' : '-'],
    ['Medium', String(severityCounts.Medium), severityCounts.Medium > 0 ? 'Routine maintenance item' : '-'],
    ['Low', String(severityCounts.Low), severityCounts.Low > 0 ? 'Monitor / cosmetic item' : '-']
  ];

  doc.autoTable({
    startY: y,
    head: [['Severity Level', 'Count', 'Action Guideline']],
    body: summaryData,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 3.5 },
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 'auto' }
    },
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 0) {
        const severity = data.cell.raw;
        if (severity === 'Critical') data.cell.styles.textColor = [220, 38, 38];
        else if (severity === 'High') data.cell.styles.textColor = [239, 68, 68];
        else if (severity === 'Medium') data.cell.styles.textColor = [180, 83, 9];
        else data.cell.styles.textColor = [16, 185, 129];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  y = doc.lastAutoTable.finalY + 12;

  // ===== DETAILED FINDINGS SECTION =====
  doc.setTextColor(...darkColor);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(findings.length === 1 ? 'Defect Diagnostic Detail' : `Detailed Findings (${findings.length} Evidence Records)`, 14, y);
  y += 4;

  findings.forEach((finding, index) => {
    const pair = resolvedPairs[index] || {};
    const originalImg = pair.original;
    const annotatedImg = pair.annotated;

    const hasOriginal = Boolean(originalImg && originalImg.dataUrl);
    const hasAnnotated = Boolean(annotatedImg && annotatedImg.dataUrl);
    const isSideBySide = hasOriginal && hasAnnotated;

    const neededInitialHeight = isSideBySide ? 120 : 90;
    if (y + neededInitialHeight > maxUsableY) {
      doc.addPage();
      y = 20;
    }

    y += 8;

    // Finding Header Ribbon Bar
    doc.setFillColor(248, 250, 252);
    doc.rect(14, y - 5, pageWidth - 28, 10, 'F');
    doc.setDrawColor(...borderGray);
    doc.rect(14, y - 5, pageWidth - 28, 10, 'S');

    doc.setTextColor(...darkColor);
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    const findingHeading = `Finding #${index + 1}: ${finding.ai_issue || 'Property Defect Observation'}`;
    doc.text(findingHeading, 18, y + 2);
    y += 12;

    const locParts = [];
    if (finding.location_in_property) locParts.push(finding.location_in_property);
    if (finding.location_direction && !finding.location_in_property?.includes(finding.location_direction)) {
      locParts.push(`[${finding.location_direction}]`);
    }
    const fullLocation = locParts.join(' ');
    const displayCategory = finding.category || finding.ai_category || 'General Property Damage';

    // SIDE-BY-SIDE OR SINGLE IMAGE
    if (isSideBySide) {
      const halfWidth = 87;
      const sideHeight = 54;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...grayColor);
      doc.text('📷 ORIGINAL BASELINE EVIDENCE', 14, y);

      try {
        doc.addImage(originalImg.dataUrl, originalImg.format || 'JPEG', 14, y + 3, halfWidth, sideHeight);
        doc.setDrawColor(203, 213, 225);
        doc.rect(14, y + 3, halfWidth, sideHeight, 'S');
      } catch (err) {
        console.warn('PDF original render error:', err);
      }

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(220, 38, 38);
      doc.text('🔍 ANNOTATED DAMAGE MARKUP', 109, y);

      try {
        doc.addImage(annotatedImg.dataUrl, annotatedImg.format || 'JPEG', 109, y + 3, halfWidth, sideHeight);
        doc.setDrawColor(239, 68, 68);
        doc.rect(109, y + 3, halfWidth, sideHeight, 'S');
      } catch (err) {
        console.warn('PDF annotated render error:', err);
      }

      y += sideHeight + 10;

      // Metadata Bar Below Side-by-Side Photos
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y - 2, pageWidth - 28, 14, 'F');
      doc.setDrawColor(...borderGray);
      doc.rect(14, y - 2, pageWidth - 28, 14, 'S');

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...grayColor);
      doc.text('Category: ', 18, y + 4);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkColor);
      doc.text(displayCategory, 36, y + 4);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...grayColor);
      doc.text('Severity: ', 80, y + 4);
      const sevColor = finding.ai_severity === 'Critical' ? [220, 38, 38] :
                       finding.ai_severity === 'High' ? [239, 68, 68] :
                       finding.ai_severity === 'Medium' ? [180, 83, 9] : [16, 185, 129];
      doc.setTextColor(...sevColor);
      doc.text(finding.ai_severity || 'Medium', 96, y + 4);

      if (fullLocation) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...grayColor);
        doc.text('Location: ', 126, y + 4);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...darkColor);
        doc.text(fullLocation, 142, y + 4);
      }

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...grayColor);
      doc.text('Confidence: ', 18, y + 9.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkColor);
      doc.text(`${finding.ai_confidence || 85}%`, 38, y + 9.5);

      if (finding.ai_model_used) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...grayColor);
        doc.text('Vision Engine: ', 80, y + 9.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...darkColor);
        const modelShort = finding.ai_model_used.split('/')[1] || finding.ai_model_used;
        doc.text(modelShort, 102, y + 9.5);
      }

      y += 18;

    } else {
      const displayImg = originalImg || annotatedImg;
      const hasImage = Boolean(displayImg && displayImg.dataUrl);
      const photoWidth = 65;
      const photoHeight = 48;

      if (hasImage) {
        try {
          doc.addImage(displayImg.dataUrl, displayImg.format || 'JPEG', 14, y, photoWidth, photoHeight);
          doc.setDrawColor(203, 213, 225);
          doc.rect(14, y, photoWidth, photoHeight, 'S');
        } catch (err) {
          console.warn(`[PDF] Image render fallback for Finding #${index + 1}:`, err);
        }
      }

      const infoX = hasImage ? 85 : 18;
      let infoY = y + 2;

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...grayColor);
      doc.text('Category:', infoX, infoY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkColor);
      doc.text(displayCategory, infoX + 22, infoY);
      infoY += 6.5;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...grayColor);
      doc.text('Severity:', infoX, infoY);
      doc.setFont('helvetica', 'normal');
      const sevColor = finding.ai_severity === 'Critical' ? [220, 38, 38] :
                       finding.ai_severity === 'High' ? [239, 68, 68] :
                       finding.ai_severity === 'Medium' ? [180, 83, 9] : [16, 185, 129];
      doc.setTextColor(...sevColor);
      doc.text(finding.ai_severity || 'Medium', infoX + 22, infoY);
      infoY += 6.5;

      if (fullLocation) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...grayColor);
        doc.text('Location:', infoX, infoY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...darkColor);
        doc.text(fullLocation, infoX + 22, infoY);
        infoY += 6.5;
      }

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...grayColor);
      doc.text('Confidence:', infoX, infoY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkColor);
      doc.text(`${finding.ai_confidence || 85}%`, infoX + 24, infoY);
      infoY += 6.5;

      if (finding.ai_model_used) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...grayColor);
        doc.text('Vision Engine:', infoX, infoY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...darkColor);
        const modelShort = finding.ai_model_used.split('/')[1] || finding.ai_model_used;
        doc.text(modelShort, infoX + 24, infoY);
      }

      y += hasImage ? (photoHeight + 5) : 28;
    }

    // Description Block
    if (y + 25 > maxUsableY) { doc.addPage(); y = 20; }
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...grayColor);
    doc.text('AI Defect Diagnosis:', 14, y);
    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkColor);
    const descLines = doc.splitTextToSize(finding.ai_description || 'No defect description provided.', pageWidth - 28);
    doc.text(descLines, 14, y);
    y += descLines.length * 4.2 + 4;

    // Inspector On-Site Observation
    if (finding.inspector_comment) {
      if (y + 25 > maxUsableY) { doc.addPage(); y = 20; }
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...grayColor);
      doc.text('Inspector On-Site Note:', 14, y);
      y += 4.5;
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(70, 70, 70);
      const commentLines = doc.splitTextToSize(finding.inspector_comment, pageWidth - 28);
      doc.text(commentLines, 14, y);
      y += commentLines.length * 4.2 + 4;
    }

    // AI Vision Recommendation (Indigo Box)
    if (finding.ai_recommendation) {
      const recLines = doc.splitTextToSize(finding.ai_recommendation || '-', pageWidth - 36);
      const recHeight = recLines.length * 4.2 + 10;
      if (y + recHeight > maxUsableY) { doc.addPage(); y = 20; }

      doc.setFillColor(238, 242, 255); // Indigo-50
      doc.rect(14, y - 2, pageWidth - 28, recHeight, 'F');
      doc.setDrawColor(199, 210, 254);
      doc.rect(14, y - 2, pageWidth - 28, recHeight, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(67, 56, 202);
      doc.text('AI Vision Recommendation:', 18, y + 4);
      y += 8.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkColor);
      doc.text(recLines, 18, y);
      y += recLines.length * 4.2 + 6;
    }

    // Inspector's Professional Recommendation (Warm Amber Gold Box)
    if (finding.inspector_recommendation) {
      const inspRecLines = doc.splitTextToSize(finding.inspector_recommendation, pageWidth - 36);
      const inspRecHeight = inspRecLines.length * 4.2 + 10;
      if (y + inspRecHeight > maxUsableY) { doc.addPage(); y = 20; }

      doc.setFillColor(254, 243, 199); // Amber-100
      doc.rect(14, y - 2, pageWidth - 28, inspRecHeight, 'F');
      doc.setDrawColor(251, 191, 36);
      doc.rect(14, y - 2, pageWidth - 28, inspRecHeight, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 83, 9);
      doc.text("Inspector's Professional Recommendation / Action Item:", 18, y + 4);
      y += 8.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkColor);
      doc.text(inspRecLines, 18, y);
      y += inspRecLines.length * 4.2 + 6;
    }

    doc.setDrawColor(...borderGray);
    doc.line(14, y + 2, pageWidth - 14, y + 2);
    y += 5;
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.text(
      `MENTIS Architectural Audit | Page ${i} of ${pageCount} | Generated ${new Date().toLocaleString()}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  const cleanTitle = (inspection.title || 'report')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 35);
  const modeTag = findings.length === 1 ? 'SingleDefect' : 'CompleteBatch';
  const filename = `Mentis_${modeTag}_${cleanTitle}_${new Date().toISOString().slice(0, 10)}.pdf`;

  doc.save(filename);
}

/**
 * Generates an official Real Estate Repair & Credit Negotiation Addendum PDF (CRL tool)
 * for buyers, realtors, and sellers to attach directly to purchase contracts.
 */
export async function generateRepairAddendumPdf(inspection, repairRequests = {}) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const primaryColor = [180, 131, 62]; // Brushed Antique Gold (#b4833e)
  const darkColor = [28, 25, 23];      // Espresso Bronze (#1c1917)
  const grayColor = [120, 113, 108];   // Warm Taupe Stone (#78716c)

  const logoDataUrl = await getMentisLogo();

  // Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, 'F');

  let textX = 14;
  if (logoDataUrl) {
    try {
      const imgFmt = logoDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(logoDataUrl, imgFmt, 14, 6, 28, 28);
      textX = 46;
    } catch (_) {}
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('PROPERTY REPAIR & CREDIT NEGOTIATION ADDENDUM', textX, 17);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Client Request List (CRL) — Official Real Estate Contract Amendment', textX, 24);

  doc.setFontSize(8.5);
  doc.text(`Generated via Mentis AI | ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, textX, 31);

  let y = 48;

  // Property & Parties Box
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, pageWidth - 28, 22, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, y, pageWidth - 28, 22, 'S');

  doc.setTextColor(...darkColor);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Property Address:', 18, y + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(inspection.property_address || 'On-Site Property Inspection', 52, y + 6.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Buyer / Client:', 18, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.text(inspection.client_name || 'Home Buyer', 52, y + 13);

  doc.setFont('helvetica', 'bold');
  doc.text('Inspection Date:', 125, y + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(inspection.created_at || Date.now()).toLocaleDateString(), 155, y + 6.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Report Reference:', 125, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.text(inspection.title || 'Inspection Audit', 155, y + 13);

  y += 28;

  const findings = inspection.findings || [];
  const requestedItems = [];
  let totalCreditAmount = 0;
  let totalContractorRepairs = 0;

  findings.forEach((f, idx) => {
    const key = f.id || idx;
    const req = repairRequests[key];
    if (req && req.requested) {
      if (req.action === 'credit' && req.creditAmount) {
        totalCreditAmount += parseFloat(req.creditAmount) || 0;
      }
      if (req.action === 'repair') {
        totalContractorRepairs++;
      }
      requestedItems.push({
        finding: f,
        index: idx + 1,
        req
      });
    }
  });

  // Financial & Request Tally Summary
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  doc.text('Summary of Buyer Requests for Negotiation', 14, y);
  y += 5;

  const tallyData = [
    ['Total Requested Items', String(requestedItems.length), 'Items selected from inspection audit for Seller action'],
    ['Licensed Contractor Repairs', String(totalContractorRepairs), 'Seller to hire licensed & insured specialists to repair'],
    ['Monetary Closing Credit', `$${totalCreditAmount.toLocaleString()}`, 'To be credited by Seller to Buyer at closing']
  ];

  doc.autoTable({
    startY: y,
    head: [['Request Category', 'Quantity / Value', 'Closing Agreement Terms']],
    body: tallyData,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 3.5 },
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 48 },
      1: { cellWidth: 38, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 'auto' }
    }
  });

  y = doc.lastAutoTable.finalY + 10;

  // Itemized Request Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Itemized Defect Requests & Contractor Requirements', 14, y);
  y += 5;

  if (requestedItems.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...grayColor);
    doc.text('No defects were selected for repair or credit. All items accepted as-is.', 14, y + 4);
    y += 15;
  } else {
    const itemsTableData = requestedItems.map((item) => {
      const f = item.finding;
      const req = item.req;
      const actionText = req.action === 'repair'
        ? '🔧 LICENSED REPAIR\n(Qualified Contractor)'
        : req.action === 'credit'
        ? `💵 CLOSING CREDIT\n$${(parseFloat(req.creditAmount) || 0).toLocaleString()}`
        : 'ℹ️ INFORMATIONAL\n(Accept Condition)';

      const defectText = `Finding #${item.index}: ${f.ai_issue}\nLocation: ${f.location_in_property || 'General Area'}${f.location_direction ? ` [${f.location_direction}]` : ''}\nSeverity: ${f.ai_severity || 'Medium'}`;

      const buyerTerms = req.notes?.trim()
        ? req.notes.trim()
        : (req.action === 'repair'
            ? 'Seller to have qualified and licensed contractor evaluate and complete repair. Paid receipt and permits provided to Buyer.'
            : req.action === 'credit'
            ? `Seller to credit Buyer $${(parseFloat(req.creditAmount) || 0).toLocaleString()} toward closing costs or price reduction.`
            : 'Acknowledged by Buyer.');

      return [defectText, actionText, buyerTerms];
    });

    doc.autoTable({
      startY: y,
      head: [['Defect Identification & Location', 'Requested Action', 'Buyer Negotiation Terms & Scope']],
      body: itemsTableData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3.5, overflow: 'linebreak' },
      headStyles: { fillColor: [40, 36, 33], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 38, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 'auto' }
      }
    });

    y = doc.lastAutoTable.finalY + 8;
  }

  // Legal Contractor Standards Clause
  if (y + 36 > pageHeight - 20) {
    doc.addPage();
    y = 20;
  }

  doc.setFillColor(254, 243, 199);
  doc.rect(14, y, pageWidth - 28, 18, 'F');
  doc.setDrawColor(251, 191, 36);
  doc.rect(14, y, pageWidth - 28, 18, 'S');

  doc.setTextColor(180, 83, 9);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('STANDARD REPAIR CONTRACT CLAUSE & TIMELINE:', 18, y + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const clauseText = 'All agreed repairs must be completed by appropriately licensed, bonded, and insured contractors in accordance with local building codes. Seller shall deliver paid invoices, contractor receipts, and transferrable warranties to Buyer no later than 3 business days prior to closing.';
  const clauseLines = doc.splitTextToSize(clauseText, pageWidth - 36);
  doc.text(clauseLines, 18, y + 9);

  y += 24;

  // Signature Block
  if (y + 40 > pageHeight - 20) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  doc.text('Mutual Real Estate Agreement Signatures', 14, y);
  y += 8;

  const colW = (pageWidth - 28) / 2;

  // Buyer & Seller
  doc.setDrawColor(180, 180, 180);
  doc.line(14, y + 8, 14 + colW - 10, y + 8);
  doc.line(14 + colW, y + 8, pageWidth - 14, y + 8);

  doc.setFontSize(7.5);
  doc.setTextColor(...grayColor);
  doc.text('Buyer Signature & Date', 14, y + 12);
  doc.text('Seller Signature & Date', 14 + colW, y + 12);

  y += 20;

  // Agents
  doc.line(14, y + 8, 14 + colW - 10, y + 8);
  doc.line(14 + colW, y + 8, pageWidth - 14, y + 8);

  doc.text("Buyer's Agent (Realtor) Signature & Date", 14, y + 12);
  doc.text("Seller's Agent (Listing) Signature & Date", 14 + colW, y + 12);

  const cleanTitle = (inspection.title || 'report')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 30);
  const filename = `Mentis_Realtor_Repair_Addendum_${cleanTitle}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
