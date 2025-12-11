import { useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ImportResult {
  success: boolean;
  data: {
    id: string;
    status: string;
    ukupnoRedova: number;
    uspjesnoSacuvano: number;
    novih: number;
    updateanih: number;
    gresaka: number;
    procenatUspjesnosti: number;
    greskeSummary: { [key: string]: number };
  };
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Molimo odaberite CSV fajl');
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post<ImportResult>(
        `${API_URL}/import/csv`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      setResult(response.data);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Greška pri upload-u fajla',
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-full p-6 lg:p-10">
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Import učenika (CSV)</h1>
            <p className="text-sm text-gray-600 mt-1">Uvezite učenike iz CSV fajla i pregledajte rezultat.</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 lg:p-8 space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-900">CSV fajl</h2>
            <p className="text-sm text-gray-600">Odaberite CSV fajl i pokrenite import.</p>
          </div>

          {/* File Upload */}
          <div className="mb-6">
            <label
              htmlFor="csv-file"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Odaberite CSV fajl
            </label>
            <div className="mt-1 flex items-center">
              <input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                disabled={uploading}
              />
            </div>
            {file && (
              <p className="mt-2 text-sm text-gray-600">
                Odabran fajl: <span className="font-medium">{file.name}</span>
              </p>
            )}
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Import u toku...
              </>
            ) : (
              'Pokreni Import'
            )}
          </button>

          {/* Error Message */}
          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Greška pri importu
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Success Result */}
          {result && result.success && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-md p-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-green-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-lg font-medium text-green-800 mb-4">
                    Import završen!
                  </h3>
                  
                  {/* Procenat uspješnosti */}
                  <div className="mb-6 bg-white rounded-md p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-700">Procenat uspješnosti</p>
                      <p className="text-2xl font-bold text-green-600">
                        {result.data.procenatUspjesnosti}%
                      </p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-green-600 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${result.data.procenatUspjesnosti}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Statistika */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-white rounded-md p-3">
                      <p className="text-sm text-gray-600">Ukupno requestano</p>
                      <p className="text-2xl font-bold text-gray-800">
                        {result.data.ukupnoRedova}
                      </p>
                    </div>
                    <div className="bg-white rounded-md p-3">
                      <p className="text-sm text-gray-600">Uspješno sačuvano</p>
                      <p className="text-2xl font-bold text-green-600">
                        {result.data.uspjesnoSacuvano}
                      </p>
                    </div>
                    <div className="bg-white rounded-md p-3">
                      <p className="text-sm text-gray-600">Novih učenika</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {result.data.novih}
                      </p>
                    </div>
                    <div className="bg-white rounded-md p-3">
                      <p className="text-sm text-gray-600">Ažurirano</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {result.data.updateanih}
                      </p>
                    </div>
                  </div>

                  {/* Summary grešaka */}
                  {result.data.gresaka > 0 && (
                    <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-4">
                      <h4 className="text-sm font-medium text-yellow-800 mb-2">
                        Summary grešaka ({result.data.gresaka}):
                      </h4>
                      <div className="space-y-1">
                        {Object.entries(result.data.greskeSummary).map(([tip, broj]) => (
                          <div key={tip} className="flex justify-between text-sm">
                            <span className="text-yellow-700">{tip}:</span>
                            <span className="font-medium text-yellow-800">{broj}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="mt-4 text-sm text-gray-600">
                    Status: <span className="font-medium">{result.data.status}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

