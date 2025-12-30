import { useState } from 'react';
import DiplomaForm from './DiplomaForm';
import { API_URL } from './constants';

interface ReportDiplomaStepProps {
  studentData: any;
  customComments: Record<string, string>;
  setCustomComments: (comments: Record<string, string>) => void;
  diplomaData: {
    imePrezime: string;
    nivo: string;
    datum: string;
    godina: string;
  };
  setDiplomaData: (data: any) => void;
}

export default function ReportDiplomaStep({
  studentData,
  customComments,
  setCustomComments,
  diplomaData,
  setDiplomaData,
}: ReportDiplomaStepProps) {
  const [activeTab, setActiveTab] = useState<'report' | 'diploma'>('report');

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('report')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'report'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Izvještaj
          </button>
          <button
            onClick={() => setActiveTab('diploma')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'diploma'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Diploma
          </button>
        </nav>
      </div>

      {/* Report Tab */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Komentari i napomene za izvještaj</h3>
            <textarea
              value={customComments.general || ''}
              onChange={(e) => setCustomComments({ ...customComments, general: e.target.value })}
              placeholder="Dodajte komentare ili napomene koje će biti uključene u izvještaj..."
              className="w-full h-40 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            />
            <p className="mt-2 text-sm text-gray-500">
              Ovi komentari će biti uključeni u generisani PDF izvještaj.
            </p>
          </div>

          {/* Report Preview Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-blue-900">Izvještaj će uključivati:</h4>
                <ul className="mt-2 text-sm text-blue-800 list-disc list-inside space-y-1">
                  <li>Osnovne podatke o učeniku</li>
                  <li>Statistiku prisustva</li>
                  <li>Detaljne ocjene po lekcijama</li>
                  <li>Progres lekcija</li>
                  <li>Vaše komentare i napomene</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Diploma Tab */}
      {activeTab === 'diploma' && (
        <div>
          <DiplomaForm
            student={studentData.ucenik}
            nastavnaGodina={studentData.nastavnaGodina}
            razredi={studentData.razredi}
            onClose={() => {}}
            onDataChange={setDiplomaData}
            initialData={diplomaData}
          />
        </div>
      )}
    </div>
  );
}




