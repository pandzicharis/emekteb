export interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'select';
  required: boolean;
  placeholder?: string;
  options?: string[]; // za select tip
}

export interface DiplomaType {
  id: string;
  name: string;
  description?: string;
  customFields: CustomField[];
}

export interface StudentDiplomaData {
  studentId: string;
  studentName: string;
  diplomaType: string;
  customFieldValues: Record<string, any>;
}

export interface Ucenik {
  id: string;
  ime: string | null;
  prezime: string | null;
  email: string | null;
  fotografija: string | null;
  aktivan: boolean;
  datumRodjenja: string | null;
  spol: string | null;
  mjestoRodjenja: string | null;
  adresaStanovanja: string | null;
  obrazovanje: {
    nivoObrazovanja: string | null;
    razred: number | null;
    mektebStepen: string | null;
  } | null;
  prosjek: number | null;
  status: string | null;
  razredNaziv: string | null;
  eksterniId: number | null;
}



