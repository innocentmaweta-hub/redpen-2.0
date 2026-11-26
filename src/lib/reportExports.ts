import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';

export type ExportRow = {
  student: string; studentId: string; course: string; institution: string; workbook: string;
  date: string; score: number; maximum: number; percentage: number;
  grade: string; feedback: string;
};

function safeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'redpen';
}

export async function exportResultsExcel(rows: ExportRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RedPen 2.0';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Assessment results');
  sheet.columns = [
    { header: 'Student', key: 'student', width: 28 },
    { header: 'Student ID', key: 'studentId', width: 20 },
    { header: 'Course', key: 'course', width: 24 },
    { header: 'Institution', key: 'institution', width: 30 },
    { header: 'Workbook', key: 'workbook', width: 28 },
    { header: 'Date', key: 'date', width: 16 },
    { header: 'Score', key: 'score', width: 12 },
    { header: 'Maximum', key: 'maximum', width: 12 },
    { header: 'Percentage', key: 'percentage', width: 14 },
    { header: 'Grade', key: 'grade', width: 10 },
    { header: 'Feedback', key: 'feedback', width: 48 },
  ];
  sheet.addRows(rows.map(row => ({ ...row, percentage: row.percentage / 100 })));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF202B3A' } };
  sheet.getColumn('percentage').numFmt = '0.0%';
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: 'K1' };
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `redpen-results-${dateStamp()}.xlsx`);
}

export function exportResultsPdf(rows: ExportRow[]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  const columns = [
    { title: 'Student', x: margin, width: 43 },
    { title: 'ID', x: 57, width: 28 },
    { title: 'Course', x: 87, width: 30 },
    { title: 'Institution', x: 119, width: 35 },
    { title: 'Workbook', x: 156, width: 32 },
    { title: 'Date', x: 190, width: 18 },
    { title: 'Score', x: 210, width: 18 },
    { title: '%', x: 230, width: 12 },
    { title: 'Grade', x: 244, width: 18 },
  ];
  let y = 17;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('RedPen 2.0 — Assessment Results', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Generated ${new Date().toLocaleString()} · ${rows.length} records`, margin, y);
  y += 9;
  const drawHeader = () => {
    doc.setFillColor(32, 43, 58);
    doc.rect(margin, y - 5, pageWidth - margin * 2, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    columns.forEach(c => doc.text(c.title, c.x, y));
    doc.setTextColor(25, 30, 38);
    y += 8;
    doc.setFont('helvetica', 'normal');
  };
  drawHeader();
  rows.forEach((row, index) => {
    if (y > 190) { doc.addPage(); y = 17; drawHeader(); }
    const values = [row.student, row.studentId || '—', row.course, row.institution || '—', row.workbook || '—', row.date, `${row.score}/${row.maximum}`, `${row.percentage.toFixed(1)}%`, row.grade];
    values.forEach((value, i) => doc.text(doc.splitTextToSize(String(value), columns[i].width)[0] || '', columns[i].x, y));
    if (index % 2 === 1) {
      doc.setDrawColor(225, 229, 234);
      doc.line(margin, y + 2, pageWidth - margin, y + 2);
    }
    y += 7;
  });
  doc.save(`redpen-results-${dateStamp()}.pdf`);
}

function dateStamp() { return new Date().toISOString().slice(0, 10); }
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
