import { useState, useEffect } from 'react';
import axios from 'axios';
import YearConclusionStepper from '../components/year-conclusion/YearConclusionStepper';

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

export default function YearConclusionPage() {
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedRazred, setSelectedRazred] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  useEffect(() => {
    const loadAcademicYears = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/reports/year-conclusion/students`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setAcademicYears(response.data || []);
        
        // Set active year as default
        const activeYear = response.data?.find((y: any) => y.status === 'ACTIVE');
        if (activeYear) {
          setSelectedYear(activeYear.id);
        }
      } catch (error) {
        console.error('Error loading academic years:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAcademicYears();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-full p-6 lg:p-10">
      <div className="w-full max-w-none mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Zaključivanje godine</h1>
          <p className="mt-1 text-base font-medium text-gray-700">
            Generisanje izvještaja i diploma za učenike
          </p>
        </div>

        <YearConclusionStepper
          academicYears={academicYears}
          selectedYear={selectedYear}
          selectedRazred={selectedRazred}
          selectedStudent={selectedStudent}
          onYearSelect={setSelectedYear}
          onRazredSelect={setSelectedRazred}
          onStudentSelect={setSelectedStudent}
        />
      </div>
    </div>
  );
}




