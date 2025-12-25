import { useState, useEffect } from 'react';
import axios from 'axios';
import StudentInfoStep from './StudentInfoStep';
import StudentStatsStep from './StudentStatsStep';
import ReportDiplomaStep from './ReportDiplomaStep';
import FinalReviewStep from './FinalReviewStep';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

interface StudentStepperProps {
  studentId: string;
  nastavnaGodinaId: string;
  razredId: string | null;
  onBack: () => void;
}

const steps = [
  { id: 1, name: 'Podaci o učeniku', description: 'Osnovni podaci i informacije' },
  { id: 2, name: 'Statistika i grafovi', description: 'Prisustvo, ocjene i napredak' },
  { id: 3, name: 'Izvještaj i diploma', description: 'Pregled i generisanje dokumenata' },
  { id: 4, name: 'Pregled i preuzimanje', description: 'Finalni pregled i download' },
];

export default function StudentStepper({ studentId, nastavnaGodinaId, razredId, onBack }: StudentStepperProps) {
  const [activeStep, setActiveStep] = useState(1);
  const [studentData, setStudentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [customComments, setCustomComments] = useState<Record<string, string>>({});
  const [diplomaData, setDiplomaData] = useState({
    imePrezime: '',
    nivo: '',
    datum: new Date().toISOString().split('T')[0],
    godina: '',
  });

  useEffect(() => {
    const loadStudentData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(
          `${API_URL}/reports/year-conclusion/student/${studentId}?nastavnaGodinaId=${nastavnaGodinaId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setStudentData(response.data);
        
        // Initialize diploma data
        if (response.data) {
          const calculatedNivo = response.data.razredi.length > 0
            ? calculateNivo(response.data.razredi[0].razred.name)
            : '';
          
          setDiplomaData({
            imePrezime: `${response.data.ucenik.ime} ${response.data.ucenik.prezime}`,
            nivo: calculatedNivo,
            datum: new Date().toISOString().split('T')[0],
            godina: response.data.nastavnaGodina.naziv,
          });
        }
      } catch (error) {
        console.error('Error loading student data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStudentData();
  }, [studentId, nastavnaGodinaId]);

  const calculateNivo = (razredName: string): string => {
    const razredMatch = razredName.match(/\d+/);
    if (!razredMatch) return '';
    const razredNum = parseInt(razredMatch[0], 10);
    if (razredNum >= 1 && razredNum <= 3) return '1';
    if (razredNum >= 4 && razredNum <= 6) return '2';
    if (razredNum >= 7 && razredNum <= 9) return '3';
    return '';
  };

  const handleNext = () => {
    if (activeStep < steps.length) {
      setActiveStep(activeStep + 1);
    }
  };

  const handlePrevious = () => {
    if (activeStep > 1) {
      setActiveStep(activeStep - 1);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="text-center py-12 text-gray-500">
        Nema podataka za ovog učenika.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stepper Navigation */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <nav aria-label="Progress">
          <ol className="flex items-center justify-between">
            {steps.map((step, stepIdx) => (
              <li key={step.id} className="relative flex-1">
                <div className="flex items-center">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                        activeStep >= step.id
                          ? 'border-indigo-600 bg-indigo-600'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      <span
                        className={`text-sm font-medium ${
                          activeStep >= step.id ? 'text-white' : 'text-gray-500'
                        }`}
                      >
                        {step.id}
                      </span>
                    </div>
                    <div className="mt-2 text-center">
                      <p
                        className={`text-xs font-medium ${
                          activeStep >= step.id ? 'text-indigo-600' : 'text-gray-500'
                        }`}
                      >
                        {step.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{step.description}</p>
                    </div>
                  </div>
                  {stepIdx < steps.length - 1 && (
                    <div
                      className={`absolute top-5 left-[calc(50%+20px)] right-0 h-0.5 ${
                        activeStep > step.id ? 'bg-indigo-600' : 'bg-gray-300'
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </div>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        {/* Back Button */}
        {activeStep > 1 && (
          <button
            onClick={activeStep === 1 ? onBack : handlePrevious}
            className="mb-6 inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-semibold text-sm transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Nazad
          </button>
        )}

        {activeStep === 1 && (
          <StudentInfoStep studentData={studentData} />
        )}

        {activeStep === 2 && (
          <StudentStatsStep studentData={studentData} />
        )}

        {activeStep === 3 && (
          <ReportDiplomaStep
            studentData={studentData}
            customComments={customComments}
            setCustomComments={setCustomComments}
            diplomaData={diplomaData}
            setDiplomaData={setDiplomaData}
          />
        )}

        {activeStep === 4 && (
          <FinalReviewStep
            studentData={studentData}
            customComments={customComments}
            diplomaData={diplomaData}
            nastavnaGodinaId={nastavnaGodinaId}
          />
        )}

        {/* Navigation Buttons */}
        <div className="mt-8 flex justify-between items-center">
          <div>
            {activeStep > 1 && (
              <button
                onClick={handlePrevious}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-slate-700 px-6 py-3 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Prethodno
              </button>
            )}
          </div>
          <div>
            {activeStep < steps.length ? (
              <button
                onClick={handleNext}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white px-6 py-3 text-sm font-semibold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-colors"
              >
                Sljedeće
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

