export class YearConclusionStudentsDto {
  nastavnaGodinaId?: string;
}

export class StudentYearConclusionDataDto {
  ucenikId: string;
  nastavnaGodinaId: string;
}

export class GenerateReportDto {
  ucenikId: string;
  nastavnaGodinaId: string;
  customComments?: Record<string, string>;
}

export class GenerateDiplomaDto {
  ucenikId: string;
  nastavnaGodinaId: string;
  imePrezime: string;
  nivo: string;
  datum: string;
  godina: string;
}

