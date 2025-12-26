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

interface RazredInfo {
  razred: {
    id: string;
    name: string;
    ilmihal?: string;
  };
  grupa?: {
    id: string;
    naziv: string;
  };
}

const steps = [
  { id: 1, name: 'Podaci o učeniku', description: 'Osnovni podaci i informacije' },
  { id: 2, name: 'Statistika i grafovi', description: 'Prisustvo, ocjene i napredak' },
  { id: 3, name: 'Izvještaj i diploma', description: 'Pregled i generisanje dokumenata' },
  { id: 4, name: 'Pregled i preuzimanje', description: 'Finalni pregled i download' },
];

export default function StudentStepper({ studentId, nastavnaGodinaId, onBack }: StudentStepperProps) {
  const [activeStep, setActiveStep] = useState(1);
  const [studentData, setStudentData] = useState<{
    ucenik: {
      id: string;
      ime: string;
      prezime: string;
      fotografija: string | null;
    };
    nastavnaGodina: {
      id: string;
      naziv: string;
    };
    razredi: RazredInfo[];
    attendance?: {
      summaryByStudent?: Array<{
        total: number;
        prisutni: number;
        procenatPrisustva: number;
      }>;
      comparisonStats?: {
        razredRank?: number;
        grupaRank?: number;
        razredAverage?: number;
        grupaAverage?: number;
      };
    };
    grades?: {
      statistics?: {
        prosjek?: number;
        total?: number;
      };
      comparisonStats?: {
        razredRank?: number;
        grupaRank?: number;
      };
    };
    stats?: {
      postotakPredjenogGradiva?: number;
      ocjenjenoLekcija?: number;
      ukupnoLekcija?: number;
    };
  } | null>(null);
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

  // Calculate quick stats for header
  const attendanceData = studentData?.attendance?.summaryByStudent?.[0] || {
    total: 0,
    prisutni: 0,
    procenatPrisustva: 0,
  };
  const gradeStats = studentData?.grades?.statistics || { prosjek: 0, total: 0 };
  const stats = studentData?.stats || {};
  const postotakGradiva = stats.postotakPredjenogGradiva || 0;

  // Get ranking info from attendance
  const attendanceComparison = studentData?.attendance?.comparisonStats;
  const grupaRank = attendanceComparison?.grupaRank;
  const razredAverage = attendanceComparison?.razredAverage;
  
  // Get ranking info from grades
  const gradesComparison = studentData?.grades?.comparisonStats;
  const razredRankGrades = gradesComparison?.razredRank;

  return (
    <div className="space-y-6">
      {/* Student Header - Always Visible */}
      <div className="sticky top-0 z-10 bg-white border border-gray-200 rounded-lg shadow-sm">
        {/* Main Header Section */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            {/* Avatar */}
            {studentData.ucenik.fotografija ? (
              <img
                src={`${API_URL}${studentData.ucenik.fotografija}`}
                alt={`${studentData.ucenik.ime} ${studentData.ucenik.prezime}`}
                className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-xl font-semibold text-indigo-600 border-2 border-gray-200 flex-shrink-0">
                {studentData.ucenik.ime.charAt(0).toUpperCase()}
                {studentData.ucenik.prezime.charAt(0).toUpperCase()}
              </div>
            )}
            
            {/* Student Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                {studentData.ucenik.ime} {studentData.ucenik.prezime}
              </h2>
              
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                <span>{studentData.nastavnaGodina.naziv}</span>
                {studentData.razredi.length > 0 && (
                  <>
                    {studentData.razredi.map((r: RazredInfo, idx: number) => (
                      <span key={idx}>
                        Razred: {r.razred.name}
                        {r.grupa && ` • Grupa: ${r.grupa.naziv}`}
                      </span>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="p-4 bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Attendance Stat */}
            <div className="bg-white rounded border border-gray-200 p-3">
              <p className="text-xs text-gray-500 mb-1">Prisustvo</p>
              <p className="text-2xl font-semibold text-gray-900">{attendanceData.procenatPrisustva}%</p>
              <p className="text-xs text-gray-500 mt-1">
                {attendanceData.prisutni}/{attendanceData.total} časova
              </p>
            </div>

            {/* Grade Average Stat */}
            <div className="bg-white rounded border border-gray-200 p-3">
              <p className="text-xs text-gray-500 mb-1">Prosjek ocjena</p>
              <p className="text-2xl font-semibold text-gray-900">
                {gradeStats.prosjek !== undefined ? gradeStats.prosjek.toFixed(2) : 'N/A'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {gradeStats.total || 0} ocjena
                {razredRankGrades && ` • #${razredRankGrades} u razredu`}
              </p>
            </div>

            {/* Progress Stat */}
            <div className="bg-white rounded border border-gray-200 p-3">
              <p className="text-xs text-gray-500 mb-1">Progres lekcija</p>
              <p className="text-2xl font-semibold text-gray-900">{postotakGradiva.toFixed(0)}%</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.ocjenjenoLekcija || 0}/{stats.ukupnoLekcija || 0} lekcija
              </p>
            </div>

            {/* Comparison Stat */}
            <div className="bg-white rounded border border-gray-200 p-3">
              <p className="text-xs text-gray-500 mb-1">Poređenje</p>
              {razredAverage !== undefined ? (
                <>
                  <p className="text-lg font-semibold text-gray-900">
                    {razredAverage.toFixed(1)}% prosjek razreda
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {attendanceData.procenatPrisustva >= razredAverage ? 'Iznad' : 'Ispod'} prosjeka
                    {grupaRank && ` • #${grupaRank} u grupi`}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-500">Nema podataka</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stepper Navigation */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <nav aria-label="Progress">
          <ol className="flex items-center">
            {steps.map((step, stepIdx) => (
              <li key={step.id} className="relative flex-1 flex items-center">
                {/* Step Circle */}
                <div className="flex flex-col items-center flex-1">
                  <div className="flex items-center w-full">
                    <div
                      className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 transition-colors ${
                        activeStep >= step.id
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : activeStep === step.id
                          ? 'border-indigo-600 bg-white text-indigo-600'
                          : 'border-gray-300 bg-white text-gray-400'
                      }`}
                    >
                      {activeStep > step.id ? (
                        <svg
                          className="h-6 w-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        <span className="text-sm font-semibold">{step.id}</span>
                      )}
                    </div>
                    {/* Connector Line */}
                    {stepIdx < steps.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mx-2 transition-colors ${
                          activeStep > step.id ? 'bg-indigo-600' : 'bg-gray-300'
                        }`}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  {/* Step Label */}
                  <div className="mt-3 text-center">
                    <p
                      className={`text-sm font-medium ${
                        activeStep >= step.id ? 'text-indigo-600' : 'text-gray-500'
                      }`}
                    >
                      {step.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{step.description}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
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
    </div>
  );
}

