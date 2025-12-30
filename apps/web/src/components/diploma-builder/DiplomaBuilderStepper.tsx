import { useState } from 'react';
import DiplomaTypeSelectionStep from './DiplomaTypeSelectionStep';
import StudentSelectionStep from './StudentSelectionStep';
import CustomFieldsStep from './CustomFieldsStep';
import ReviewStep from './ReviewStep';
import { StudentDiplomaData, Ucenik } from './types';

const steps = [
  { id: 1, name: 'Tip diplome', description: 'Odaberite tip diplome' },
  { id: 2, name: 'Odabir učenika', description: 'Odaberite učenike za diplome' },
  { id: 3, name: 'Postavke', description: 'Popunite postavke za svakog učenika' },
  { id: 4, name: 'Pregled', description: 'Pregled i generisanje' },
];

interface DiplomaBuilderStepperProps {
  selectedDiplomaType: string | null;
  onDiplomaTypeSelect: (typeId: string | null) => void;
  selectedStudents: Ucenik[];
  onStudentsChange: (students: Ucenik[]) => void;
  studentsData: StudentDiplomaData[];
  onStudentsDataChange: (data: StudentDiplomaData[]) => void;
  onGenerate: () => void;
  onReset: () => void;
  loading?: boolean;
  successMessage?: string | null;
}

export default function DiplomaBuilderStepper({
  selectedDiplomaType,
  onDiplomaTypeSelect,
  selectedStudents,
  onStudentsChange,
  studentsData,
  onStudentsDataChange,
  onGenerate,
  onReset,
  loading = false,
  successMessage = null,
}: DiplomaBuilderStepperProps) {
  const [activeStep, setActiveStep] = useState(1);

  const handleNext = () => {
    if (activeStep < steps.length) {
      setActiveStep(activeStep + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 1) {
      setActiveStep(activeStep - 1);
    }
  };

  // Reset step when reset is triggered from parent
  const handleReset = () => {
    setActiveStep(1);
    onReset();
  };

  return (
    <div className="space-y-6">
      {/* Stepper Navigation */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <nav aria-label="Progress">
          <ol className="flex items-center">
            {steps.map((step, stepIdx) => (
              <li key={step.id} className="relative flex-1 flex items-center">
                <div className="flex flex-col items-center flex-1">
                  <div className="flex items-center w-full">
                    <div
                      className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 transition-colors ${
                        activeStep > step.id
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
                    {stepIdx < steps.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mx-2 transition-colors ${
                          activeStep > step.id ? 'bg-indigo-600' : 'bg-gray-300'
                        }`}
                        aria-hidden="true"
                      />
                    )}
                  </div>
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
          {/* Step 1: Diploma Type Selection */}
          {activeStep === 1 && (
            <DiplomaTypeSelectionStep
              selectedType={selectedDiplomaType}
              onSelect={onDiplomaTypeSelect}
              onNext={handleNext}
            />
          )}

          {/* Step 2: Student Selection */}
          {activeStep === 2 && (
            <StudentSelectionStep
              selectedStudents={selectedStudents}
              onStudentsChange={onStudentsChange}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}

          {/* Step 3: Custom Fields */}
          {activeStep === 3 && (
            <CustomFieldsStep
              diplomaType={selectedDiplomaType}
              selectedStudents={selectedStudents}
              studentsData={studentsData}
              onStudentsDataChange={onStudentsDataChange}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}

          {/* Step 4: Review */}
          {activeStep === 4 && (
            <ReviewStep
              studentsData={studentsData}
              onGenerate={onGenerate}
              onBack={handleBack}
              onReset={handleReset}
              loading={loading}
              successMessage={successMessage}
            />
          )}
        </div>
      </div>
    </div>
  );
}

