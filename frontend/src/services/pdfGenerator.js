import jsPDF from 'jspdf';
import 'jspdf-autotable';

export function generatePdfReport(inspection) {
  const doc = new jsPDF();
  const findings = inspection.findings || [];
  const pageWidth = doc.internal.pageSize.getWidth();

  // Colors - Florentine Gold & Espresso Bronze Luxury
  const primaryColor = [180, 131, 62]; // Brushed Antique Gold (#b4833e)
  const darkColor = [28, 25, 23];      // Espresso Bronze (#1c1917)
  const grayColor = [120, 113, 108];   // Warm Taupe Stone (#78716c)

  // ===== HEADER =====
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 45, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('MENTIS', 14, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Architectural & Property Inspection AI', 14, 25);

  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 32);

  // ===== INSPECTION INFO =====
  let y = 55;

  doc.setTextColor(...darkColor);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(inspection.title || 'Inspection Report', 14, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);

  if (inspection.property_address) {
    doc.text(`Property Address: ${inspection.property_address}`, 14, y);
    y += 6;
  }
  if (inspection.client_name) {
    doc.text(`Client: ${inspection.client_name}`, 14, y);
    y += 6;
  }
  if (inspection.property_type) {
    doc.text(`Property Type: ${inspection.property_type}`, 14, y);
    y += 6;
  }
  doc.text(`Date: ${new Date(inspection.created_at).toLocaleDateString()}`, 14, y);
  y += 6;
  doc.text(`Total Findings: ${findings.length}`, 14, y);
  y += 12;

  // ===== SEVERITY SUMMARY =====
  const severityCounts = {
    Critical: findings.filter(f => f.ai_severity === 'Critical').length,
    High: findings.filter(f => f.ai_severity === 'High').length,
    Medium: findings.filter(f => f.ai_severity === 'Medium').length,
    Low: findings.filter(f => f.ai_severity === 'Low').length
  };

  doc.setTextColor(...darkColor);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Severity Summary', 14, y);
  y += 8;

  const summaryData = [
    ['Critical', String(severityCounts.Critical), severityCounts.Critical > 0 ? 'Immediate attention required' : '-'],
    ['High', String(severityCounts.High), severityCounts.High > 0 ? 'Needs prompt attention' : '-'],
    ['Medium', String(severityCounts.Medium), severityCounts.Medium > 0 ? 'Should be addressed' : '-'],
    ['Low', String(severityCounts.Low), severityCounts.Low > 0 ? 'Monitor or plan' : '-']
  ];

  doc.autoTable({
    startY: y,
    head: [['Severity', 'Count', 'Action Level']],
    body: summaryData,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 25, halign: 'center' },
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

  y = doc.lastAutoTable.finalY + 15;

  // ===== DETAILED FINDINGS =====
  doc.setTextColor(...darkColor);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Detailed Findings', 14, y);
  y += 3;

  findings.forEach((finding, index) => {
    // Check if we need a new page
    if (y > 220) {
      doc.addPage();
      y = 20;
    }

    y += 10;

    // Finding number and title
    doc.setFillColor(248, 250, 252);
    doc.rect(14, y - 5, pageWidth - 28, 10, 'F');

    doc.setTextColor(...darkColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Finding #${index + 1}: ${finding.ai_issue}`, 16, y + 2);
    y += 14;

    // Finding image
    const imgData = finding.image_data
      ? `data:${finding.image_mime_type || 'image/jpeg'};base64,${finding.image_data}`
      : (finding.image_url?.startsWith('data:') ? finding.image_url : null);

    if (imgData) {
      try {
        doc.addImage(imgData, 'JPEG', 14, y, 60, 45);
        
        // Info next to image
        let infoX = 80;
        let infoY = y;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...grayColor);

        doc.text('Category:', infoX, infoY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...darkColor);
        doc.text(finding.ai_category || '-', infoX + 25, infoY);
        infoY += 7;

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...grayColor);
        doc.text('Severity:', infoX, infoY);
        doc.setFont('helvetica', 'normal');
        const sevColor = finding.ai_severity === 'Critical' ? [220, 38, 38] :
                         finding.ai_severity === 'High' ? [239, 68, 68] :
                         finding.ai_severity === 'Medium' ? [180, 83, 9] : [16, 185, 129];
        doc.setTextColor(...sevColor);
        doc.text(finding.ai_severity || '-', infoX + 25, infoY);
        infoY += 7;

        if (finding.location_in_property) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...grayColor);
          doc.text('Location:', infoX, infoY);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...darkColor);
          doc.text(finding.location_in_property, infoX + 25, infoY);
          infoY += 7;
        }

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...grayColor);
        doc.text('Confidence:', infoX, infoY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...darkColor);
        doc.text(`${finding.ai_confidence || 0}%`, infoX + 28, infoY);

        y += 50;
      } catch (e) {
        y += 5;
      }
    }

    // Description
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...grayColor);
    doc.text('Description:', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkColor);

    const descLines = doc.splitTextToSize(finding.ai_description || '-', pageWidth - 28);
    doc.text(descLines, 14, y);
    y += descLines.length * 4.5 + 4;

    // Inspector comment
    if (finding.inspector_comment) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...grayColor);
      doc.text('Inspector Note:', 14, y);
      y += 5;
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      const commentLines = doc.splitTextToSize(finding.inspector_comment, pageWidth - 28);
      doc.text(commentLines, 14, y);
      y += commentLines.length * 4.5 + 4;
    }

    // Recommendation
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFillColor(238, 242, 255);
    const recLines = doc.splitTextToSize(finding.ai_recommendation || '-', pageWidth - 36);
    const recHeight = recLines.length * 4.5 + 10;
    doc.rect(14, y - 2, pageWidth - 28, recHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('Recommendation:', 18, y + 4);
    y += 9;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkColor);
    doc.text(recLines, 18, y);
    y += recLines.length * 4.5 + 8;

    // Divider line
    doc.setDrawColor(226, 232, 240);
    doc.line(14, y, pageWidth - 14, y);
    y += 3;
  });

  // ===== FOOTER =====
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.text(
      `MENTIS Architectural Audit | Page ${i} of ${pageCount} | Generated ${new Date().toLocaleString()}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Download
  const filename = `Mentis_Inspection_Audit_${inspection.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'report'}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
