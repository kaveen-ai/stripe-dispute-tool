const PDFDocument = require('pdfkit');

/**
 * Streams a formal Visa/Mastercard compliant evidence PDF directly to the Express response.
 * @param {Object} disputeData - Structured dispute and charge metadata from stripeService
 * @param {import('express').Response} res - Express response stream
 */
function buildEvidencePDF(disputeData, res) {
  // 1. Instantiate PDF with standard A4 margins
  const doc = new PDFDocument({ margin: 50 });

  // 2. Set headers to force browser download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Evidence_Pack_${disputeData.disputeId}.pdf`);

  // 3. Pipe PDF directly to the client (no temp files, memory efficient)
  doc.pipe(res);

  // ---------- HEADER ----------
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000')
     .text('CHARGEBACK DISPUTE EVIDENCE PACK', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(12).font('Helvetica').fillColor('#555555')
     .text('Visa / Mastercard Compliant Dispute Submission', { align: 'center' });
  doc.moveDown(1);

  // ---------- DIVIDER LINE ----------
  doc.moveTo(50, doc.y).lineTo(550, doc.y)
     .strokeColor('#cccccc').lineWidth(1).stroke();
  doc.moveDown(1.5);

  // ---------- SECTION 1: Transaction & Dispute Summary ----------
  doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold')
     .text('Section 1: Transaction & Dispute Summary');
  doc.moveDown(0.5);
  doc.fontSize(11).font('Helvetica').fillColor('#333333');
  doc.text(`Dispute ID:     ${disputeData.disputeId}`);
  doc.text(`Amount:         ${disputeData.amount.toFixed(2)} ${disputeData.currency}`);
  doc.text(`Currency:       ${disputeData.currency}`);
  doc.text(`Reason Code:    ${disputeData.reason}`);
  doc.text(`Dispute Status: ${disputeData.status}`);
  doc.text(`Date Created:   ${disputeData.created}`);
  doc.moveDown(1.5);

  // ---------- SECTION 2: Customer Metadata & Verification ----------
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000')
     .text('Section 2: Customer Metadata & Verification');
  doc.moveDown(0.5);
  doc.fontSize(11).font('Helvetica').fillColor('#333333');
  doc.text(`Customer Name:  ${disputeData.customerName}`);
  doc.text(`Customer Email: ${disputeData.customerEmail}`);
  doc.text(`Charge ID:      ${disputeData.chargeId}`);
  doc.text(`Payment Method: ${disputeData.paymentMethod}`);
  doc.moveDown(1.5);

  // ---------- SECTION 3: Terms & Policy Compliance Statement ----------
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000')
     .text('Section 3: Terms & Policy Compliance Statement');
  doc.moveDown(0.5);
  doc.fontSize(11).font('Helvetica').fillColor('#333333');
  
  const complianceText = 
    'The customer agreed to the Terms of Service and Refund Policy at the time of checkout. ' +
    'The merchant has provided the goods or services as described, and the customer acknowledged these terms ' +
    'prior to completing the transaction. This evidence is submitted in good faith and in accordance with ' +
    'Visa and Mastercard dispute resolution guidelines.';
  
  doc.text(complianceText, { align: 'justify' });
  doc.moveDown(2);

  // ---------- FOOTER ----------
  // Position footer at the bottom of the page
  doc.fontSize(9).font('Helvetica').fillColor('#888888')
     .text(
       'Generated automatically by Stripe Dispute Evidence Packaging Tool.',
       50,
       doc.page.height - 50,
       { align: 'center' }
     );

  // 4. Finalize the document and end the stream
  doc.end();
}

module.exports = { buildEvidencePDF };