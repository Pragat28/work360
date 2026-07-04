const PDFDocument = require('pdfkit');

const generateTimelinePdf = (employee, timelineEvents) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // ── Header ──
      doc
        .fillColor('#1a73e8')
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('BFSI Edge', 50, 50);

      doc
        .fillColor('#333')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('3-Month Timeline Report', 50, 80);

      doc
        .moveTo(50, 105)
        .lineTo(550, 105)
        .strokeColor('#e0e0e0')
        .stroke();

      // ── Employee Info ──
      doc
        .fillColor('#555')
        .fontSize(11)
        .font('Helvetica')
        .text(`Employee: ${employee.name}`, 50, 120)
        .text(`Email: ${employee.email}`, 50, 138)
        .text(`Department: ${employee.department || 'N/A'}`, 50, 156)
        .text(`Report Period: Last 3 months`, 50, 174)
        .text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, 50, 192);

      doc
        .moveTo(50, 215)
        .lineTo(550, 215)
        .strokeColor('#e0e0e0')
        .stroke();

      // ── Timeline Events ──
      doc
        .fillColor('#1a73e8')
        .fontSize(13)
        .font('Helvetica-Bold')
        .text('Timeline Events', 50, 230);

      let y = 258;

      if (!timelineEvents || timelineEvents.length === 0) {
        doc
          .fillColor('#999')
          .fontSize(11)
          .font('Helvetica')
          .text('No timeline events found for this period.', 50, y);
      } else {
        timelineEvents.forEach((group) => {
          // Check if we need a new page
          if (y > 700) {
            doc.addPage();
            y = 50;
          }

          // Date header
          doc
            .fillColor('#333')
            .fontSize(11)
            .font('Helvetica-Bold')
            .text(group.date, 50, y);

          y += 18;

          group.events.forEach((event) => {
            if (y > 700) {
              doc.addPage();
              y = 50;
            }

            const typeColors = {
              completed: '#16a34a',
              started:   '#1a73e8',
              overdue:   '#e53935',
              assigned:  '#7c3aed',
              submitted: '#f59e0b',
            };

            const color = typeColors[event.type] || '#555';
            const bullet = {
              completed: '✓',
              started:   '▶',
              overdue:   '!',
              assigned:  '★',
              submitted: '↑',
            }[event.type] || '•';

            doc
              .fillColor(color)
              .fontSize(10)
              .font('Helvetica-Bold')
              .text(`${bullet} ${event.title}`, 65, y);

            doc
              .fillColor('#777')
              .fontSize(9)
              .font('Helvetica')
              .text(event.sub || '', 80, y + 13);

            y += 32;
          });

          y += 6;
        });
      }

      // ── Footer ──
      doc
        .fillColor('#aaa')
        .fontSize(9)
        .font('Helvetica')
        .text('This is an auto-generated report by BFSI Edge.', 50, 780, { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = generateTimelinePdf;
