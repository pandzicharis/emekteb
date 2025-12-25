import { useState, useEffect } from 'react';
import axios from 'axios';
import DiplomaPreview from './DiplomaPreview';
import useGenerateDiploma from '../../hooks/useGenerateDiploma';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

interface DiplomaFormProps {
  student: {
    id: string;
    ime: string;
    prezime: string;
  };
  nastavnaGodina: {
    id: string;
    naziv: string;
    datumOd: string;
    datumDo: string;
  };
  razredi: Array<{
    razred: {
      name: string;
    };
  }>;
  onClose: () => void;
  onDataChange?: (data: any) => void;
  initialData?: {
    imePrezime: string;
    nivo: string;
    datum: string;
    godina: string;
  };
}

// Helper function to calculate nivo based on razred
const calculateNivo = (razredName: string): string => {
  // Extract number from razred name (e.g., "Razred 1", "1. razred", "1", etc.)
  const razredMatch = razredName.match(/\d+/);
  if (!razredMatch) return '';
  
  const razredNum = parseInt(razredMatch[0], 10);
  
  if (razredNum >= 1 && razredNum <= 3) return '1';
  if (razredNum >= 4 && razredNum <= 6) return '2';
  if (razredNum >= 7 && razredNum <= 9) return '3';
  
  return '';
};

export default function DiplomaForm({ 
  student, 
  nastavnaGodina, 
  razredi, 
  onClose,
  onDataChange,
  initialData,
}: DiplomaFormProps) {
  const calculatedNivo = razredi.length > 0 
    ? calculateNivo(razredi[0].razred.name)
    : '';
  
  const [imePrezime, setImePrezime] = useState(initialData?.imePrezime || `${student.ime} ${student.prezime}`);
  const [nivo, setNivo] = useState(initialData?.nivo || calculatedNivo);
  const [datum, setDatum] = useState(initialData?.datum || new Date().toISOString().split('T')[0]);
  const [godina, setGodina] = useState(initialData?.godina || nastavnaGodina.naziv);
  
  // Update nivo when razred changes
  useEffect(() => {
    if (razredi.length > 0) {
      const newNivo = calculateNivo(razredi[0].razred.name);
      setNivo(newNivo);
    }
  }, [razredi]);

  // Notify parent of data changes
  useEffect(() => {
    if (onDataChange) {
      onDataChange({ imePrezime, nivo, datum, godina });
    }
  }, [imePrezime, nivo, datum, godina, onDataChange]);

  const { generateDiploma, previewUrl, loading, inspectPdfFields, pdfFields } = useGenerateDiploma();
  const [showFieldsInfo, setShowFieldsInfo] = useState(false);

  // Automatically inspect PDF fields when component mounts
  useEffect(() => {
    console.log('=== DiplomaForm mounted - Inspecting PDF fields ===');
    inspectPdfFields();
  }, []);

  const handlePreview = async () => {
    await generateDiploma({
      imePrezime,
      nivo,
      datum,
      godina,
    });
  };

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/reports/year-conclusion/generate-diploma`,
        {
          ucenikId: student.id,
          nastavnaGodinaId: nastavnaGodina.id,
          imePrezime,
          nivo,
          datum,
          godina,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: 'blob',
        }
      );

      // Create blob and download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `diploma_${student.ime}_${student.prezime}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error generating diploma:', error);
      alert('Greška pri generisanju diplome');
    }
  };

  const handleInspectFields = async () => {
    await inspectPdfFields();
    setShowFieldsInfo(true);
  };

  return (
    <div className="space-y-6">
      {/* Debug: Inspect PDF Fields */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-yellow-800">Debug: PDF Form Fields</h4>
          <button
            onClick={handleInspectFields}
            className="text-xs px-3 py-1.5 bg-yellow-200 text-yellow-800 rounded-lg hover:bg-yellow-300 font-medium transition-colors"
          >
            Provjeri polja u PDF-u
          </button>
        </div>
        {pdfFields.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-yellow-700 mb-1">Pronađena polja ({pdfFields.length}):</p>
            <div className="bg-white rounded p-2 text-xs font-mono">
              {pdfFields.map((field, idx) => (
                <div key={idx} className="text-yellow-900">
                  • {field}
                </div>
              ))}
            </div>
            <p className="text-xs text-yellow-600 mt-2">
              Provjeri konzolu (F12) za detaljne informacije
            </p>
          </div>
        )}
        {showFieldsInfo && pdfFields.length === 0 && (
          <p className="text-xs text-yellow-600 mt-2">
            PDF nema form polja. Koristit će se drawText metoda sa koordinatama.
          </p>
        )}
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ime i prezime
          </label>
          <input
            type="text"
            value={imePrezime}
            onChange={(e) => setImePrezime(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nivo (automatski izračunato)
          </label>
          <input
            type="text"
            value={nivo}
            onChange={(e) => setNivo(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50"
            readOnly
            title={`Izračunato na osnovu razreda: ${razredi.length > 0 ? razredi[0].razred.name : 'N/A'}`}
          />
          {razredi.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Razred: {razredi[0].razred.name} → Nivo: {nivo}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Datum
          </label>
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Godina (naziv nastavne godine)
          </label>
          <input
            type="text"
            value={godina}
            onChange={(e) => setGodina(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Preview Button - Only show if onClose is provided (not in stepper) */}
      {onClose && (
        <div className="flex gap-4">
          <button
            onClick={handlePreview}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white px-6 py-3 text-sm font-semibold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Generisanje...' : 'Pregled diplome'}
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 px-6 py-3 text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Otkaži
          </button>
        </div>
      )}

      {/* Preview */}
      {previewUrl && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pregled diplome</h3>
          <DiplomaPreview pdfUrl={previewUrl} />
          <div className="mt-4">
            <button
              onClick={handleDownload}
              className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Preuzmi PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

