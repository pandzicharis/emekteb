// Placeholder component for report preview
// The actual PDF generation and download is handled in StudentReportView
// This component can be extended if inline preview is needed

interface ReportPreviewProps {
  pdfUrl?: string;
}

export default function ReportPreview({ pdfUrl }: ReportPreviewProps) {
  if (!pdfUrl) {
    return (
      <div className="text-center py-12 text-gray-500">
        Generiši izvještaj da bi vidio pregled
      </div>
    );
  }

  return (
    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
      <iframe
        src={pdfUrl}
        className="w-full h-[600px] border-0"
        title="PDF Preview"
      />
    </div>
  );
}







