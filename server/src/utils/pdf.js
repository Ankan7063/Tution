import PDFDocument from 'pdfkit';

export function buildReceiptPdf(payment, settings) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const symbol = settings?.currencySymbol || '₹';
    const amount = Number(payment.amount).toFixed(2);

    doc.fontSize(22).fillColor('#6d28d9').text(settings?.centerName || 'Tuition Center', { align: 'center' });
    if (settings?.address) doc.fontSize(10).fillColor('#555').text(settings.address, { align: 'center' });
    if (settings?.phone) doc.fontSize(10).fillColor('#555').text(`Phone: ${settings.phone}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).fillColor('#000').text('FEE PAYMENT RECEIPT', { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(11).fillColor('#000');
    const left = [
      ['Receipt No:', payment.receiptNo],
      ['Student:', payment.student?.name || '—'],
      ['Admission No:', payment.student?.admissionNo || '—'],
      ['Fee Type:', payment.feeRecord?.feeType || 'General'],
      ['Period:', payment.feeRecord?.period || '—'],
    ];
    const right = [
      ['Date:', new Date(payment.paymentDate).toLocaleDateString('en-IN')],
      ['Method:', payment.method],
      ['Received By:', payment.receivedBy?.email || 'Admin'],
    ];
    let y = doc.y;
    left.forEach(([k, v]) => { doc.text(`${k} ${v}`, 50, y); y += 18; });
    y = doc.y - left.length * 18;
    right.forEach(([k, v]) => { doc.text(`${k} ${v}`, 350, y); y += 18; });

    doc.moveDown(3);
    doc.rect(50, doc.y, 495, 30).fillAndStroke('#f3e8ff', '#6d28d9');
    doc.fillColor('#000').fontSize(13).text(`Amount Received: ${symbol} ${amount}`, 60, doc.y - 24);
    if (payment.note) {
      doc.moveDown(2).fontSize(10).fillColor('#555').text(`Note: ${payment.note}`);
    }
    doc.moveDown(4).fontSize(10).fillColor('#777')
      .text('This is a computer-generated receipt and does not require a physical signature.', { align: 'center' });
    doc.end();
  });
}
