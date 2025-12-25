import { useState, useEffect } from 'react';

interface DiplomaPreviewProps {
  pdfUrl: string;
}

export default function DiplomaPreview({ pdfUrl }: DiplomaPreviewProps) {
  const [useIframe, setUseIframe] = useState(true);
  const [reactPdfLoaded, setReactPdfLoaded] = useState(false);

  useEffect(() => {
    // Try to load react-pdf, but fallback to iframe if it fails
    import('react-pdf')
      .then((module) => {
        setReactPdfLoaded(true);
      })
      .catch(() => {
        console.warn('react-pdf not available, using iframe fallback');
        setUseIframe(true);
      });
  }, []);

  // Simple iframe approach - works reliably
  if (useIframe || !reactPdfLoaded) {
    return (
      <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
        <iframe
          src={pdfUrl}
          className="w-full h-[600px] border-0 rounded"
          title="PDF Preview"
        />
      </div>
    );
  }

  // If react-pdf is loaded, we could use it here, but for now iframe is simpler
  return (
    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
      <iframe
        src={pdfUrl}
        className="w-full h-[600px] border-0 rounded"
        title="PDF Preview"
      />
    </div>
  );
}
