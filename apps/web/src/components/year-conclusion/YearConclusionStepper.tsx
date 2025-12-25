import { useState, useEffect } from 'react';
import AcademicYearAccordion from './AcademicYearAccordion';
import StudentStepper from './StudentStepper';

interface YearConclusionStepperProps {
  academicYears: any[];
  selectedYear: string | null;
  selectedRazred: string | null;
  selectedStudent: string | null;
  onYearSelect: (yearId: string | null) => void;
  onRazredSelect: (razredId: string | null) => void;
  onStudentSelect: (studentId: string | null) => void;
}

export default function YearConclusionStepper({
  academicYears,
  selectedYear,
  selectedRazred,
  selectedStudent,
  onYearSelect,
  onRazredSelect,
  onStudentSelect,
}: YearConclusionStepperProps) {
  const handleStudentClick = (studentId: string, razredId: string) => {
    onStudentSelect(studentId);
    onRazredSelect(razredId);
  };

  // If student is selected, show student stepper
  if (selectedStudent && selectedYear) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <button
          onClick={() => {
            onStudentSelect(null);
            onRazredSelect(null);
          }}
          className="mb-6 inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-semibold text-sm transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Nazad na listu učenika
        </button>
        <StudentStepper
          studentId={selectedStudent}
          nastavnaGodinaId={selectedYear}
          razredId={selectedRazred}
          onBack={() => {
            onStudentSelect(null);
            onRazredSelect(null);
          }}
        />
      </div>
    );
  }

  // Show only active year directly
  const activeYear = academicYears.find((y: any) => y.status === 'ACTIVE' || selectedYear === y.id);
  
  // Auto-select active year if not already selected
  useEffect(() => {
    if (!selectedYear && activeYear) {
      onYearSelect(activeYear.id);
    }
  }, [selectedYear, activeYear, onYearSelect]);
  
  if (!activeYear) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <p className="text-gray-500">Nema aktivne nastavne godine.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
      <AcademicYearAccordion
        key={activeYear.id}
        year={activeYear}
        isExpanded={selectedYear === activeYear.id}
        onExpand={() => {
          if (selectedYear === activeYear.id) {
            onYearSelect(null);
          } else {
            onYearSelect(activeYear.id);
          }
        }}
        onStudentClick={handleStudentClick}
      />
    </div>
  );
}

