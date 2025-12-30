import { useState } from 'react';
import DiplomaBuilderStepper from '../components/diploma-builder/DiplomaBuilderStepper';
import { StudentDiplomaData, Ucenik } from '../components/diploma-builder/types';
import axios from 'axios';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

export default function DiplomaBuilderPage() {
  const [selectedDiplomaType, setSelectedDiplomaType] = useState<string | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Ucenik[]>([]);
  const [studentsData, setStudentsData] = useState<StudentDiplomaData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');

      // Transform studentsData to match backend DTO format
      const students = studentsData.map((sd) => {
        const student: any = {
          type: sd.diplomaType,
          ime_prezime: sd.studentName,
          datum: sd.customFieldValues.datum || '',
        };

        // Add optional fields only if they exist
        if (sd.customFieldValues.nastavna_godina) {
          student.nastavna_godina = sd.customFieldValues.nastavna_godina;
        }
        if (sd.customFieldValues.nivo) {
          student.nivo = sd.customFieldValues.nivo;
        }
        if (sd.customFieldValues.kategorija) {
          student.kategorija = sd.customFieldValues.kategorija;
        }
        if (sd.customFieldValues.godina) {
          student.godina = sd.customFieldValues.godina;
        }

        return student;
      });

      // Generate diplomas one by one to ensure all are created
      // This approach is more reliable than batch endpoint for now
      let successCount = 0;
      let errorCount = 0;
      
      // Clear any previous messages
      setSuccessMessage(null);
      setError(null);
      
      for (let i = 0; i < students.length; i++) {
        const student = students[i];
        try {
          const response = await axios.post(
            `${API_URL}/diplome/generate`,
            student,
            {
              headers: { Authorization: `Bearer ${token}` },
              responseType: 'blob',
            }
          );

          // Create blob and download
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute(
            'download',
            `diploma_${student.type}_${student.ime_prezime.replace(/\s+/g, '_')}.pdf`
          );
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
          successCount++;

          // Small delay between downloads to avoid browser blocking
          if (i < students.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (err: any) {
          console.error(`Error generating diploma for ${student.ime_prezime}:`, err);
          errorCount++;
          // Continue with next student even if one fails
        }
      }

      if (successCount > 0) {
        setSuccessMessage(`${successCount} ${successCount === 1 ? 'diploma je uspješno generisana' : 'diploma je uspješno generisano'}${errorCount > 0 ? ` (${errorCount} ${errorCount === 1 ? 'greška' : 'greške'})` : ''}`);
      } else {
        setError('Nijedna diploma nije uspješno generisana');
      }
    } catch (err: any) {
      console.error('Error generating diplomas:', err);
      setError(err.response?.data?.message || 'Greška pri generisanju diploma');
    } finally {
      setLoading(false);
    }
  };

  const handleDiplomaTypeSelect = (typeId: string | null) => {
    setSelectedDiplomaType(typeId);
    // Reset students when diploma type changes
    setSelectedStudents([]);
    setStudentsData([]);
  };

  const handleReset = () => {
    // Reset everything to start fresh
    setSelectedDiplomaType(null);
    setSelectedStudents([]);
    setStudentsData([]);
    setSuccessMessage(null);
    setError(null);
    // Note: Step reset is handled in DiplomaBuilderStepper component
  };

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-full p-6 lg:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Generator diploma</h1>
          <p className="text-gray-600">
            Generišite diplome za učenike u nekoliko jednostavnih koraka
          </p>
        </div>

        {/* Error Message */}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

        {/* Stepper */}
        <DiplomaBuilderStepper
          selectedDiplomaType={selectedDiplomaType}
          onDiplomaTypeSelect={handleDiplomaTypeSelect}
          selectedStudents={selectedStudents}
          onStudentsChange={setSelectedStudents}
          studentsData={studentsData}
          onStudentsDataChange={setStudentsData}
          onGenerate={handleGenerate}
          onReset={handleReset}
          loading={loading}
          successMessage={successMessage}
        />
      </div>
    </div>
  );
}


