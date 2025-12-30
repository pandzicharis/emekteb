import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportColumn {
  header: string;
  dataKey: string;
  width?: number;
}

export interface ExportOptions {
  title: string;
  filename?: string;
  columns: ExportColumn[];
  data: Record<string, any>[];
  orientation?: 'portrait' | 'landscape';
}

export const exportToPDF = (options: ExportOptions) => {
  const doc = new jsPDF({
    orientation: options.orientation || 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Add title
  doc.setFontSize(16);
  doc.text(options.title, 14, 20);

  // Prepare table data
  const tableColumns = options.columns.map((col) => ({
    header: col.header,
    dataKey: col.dataKey,
  }));

  const tableRows = options.data.map((row) =>
    options.columns.map((col) => {
      const value = row[col.dataKey];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    })
  );

  autoTable(doc, {
    head: [options.columns.map((col) => col.header)],
    body: tableRows,
    startY: 30,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  // Save PDF
  doc.save(options.filename || `${options.title}.pdf`);
};

export const exportToCSV = (options: { filename?: string; columns: ExportColumn[]; data: Record<string, any>[] }) => {
  // Create CSV header
  const headers = options.columns.map((col) => col.header).join(',');
  
  // Create CSV rows
  const rows = options.data.map((row) =>
    options.columns
      .map((col) => {
        const value = row[col.dataKey];
        if (value === null || value === undefined) return '';
        // Escape commas and quotes in CSV
        const stringValue = String(value).replace(/"/g, '""');
        return `"${stringValue}"`;
      })
      .join(',')
  );

  // Combine header and rows
  const csvContent = [headers, ...rows].join('\n');

  // Create blob and download
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', options.filename || 'export.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

