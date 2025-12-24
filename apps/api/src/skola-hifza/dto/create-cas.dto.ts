export class CreateCasDto {
  rasporedId!: string;
  datum!: string; // ISO date string
  napomena?: string;
  napredak?: {
    [studentId: string]: {
      [suraName: string]: number[]; // Array of learned ajeta numbers
    };
  };
  komentari?: {
    [studentId: string]: {
      [suraName: string]: string; // Komentar po suri
    };
  };
  prisutni?: Array<{
    ucenikId: string;
    status: 'PRISUTAN' | 'OPRAVDAN' | 'NEOPRAVDAN';
  }>;
}
