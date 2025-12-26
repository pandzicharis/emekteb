export class PeriodDto {
  od!: string; // Format: "YYYY-MM-DD"
  do!: string; // Format: "YYYY-MM-DD"
}

export class RasporedDto {
  day!: 'subota' | 'nedjelja';
  slot!: string; // Format: "HH:mm"
  location!: string;
  duration!: number; // u minutama
}

export class PostavkeGrupeDto {
  kuran!: boolean;
  sufara!: boolean;
}

export class UceniciDto {
  grupaA!: string[]; // Array of ucenik IDs
  grupaB?: string[]; // Optional, samo ako je split true
}

export class RazredNastavnaGodinaDto {
  razred!: number; // Broj razreda (ne ID)
  razredId!: string; // ID razreda iz baze
  muallimId!: string;
  split!: boolean;
  ucenici!: UceniciDto;
  raspored!: {
    grupaA: RasporedDto;
    grupaB?: RasporedDto; // Optional, samo ako je split true
  };
  postavkeGrupe!: {
    grupaA: PostavkeGrupeDto;
    grupaB?: PostavkeGrupeDto; // Optional, samo ako je split true
  };
}

export class NastavnaGodinaDto {
  naziv!: string;
  opis!: string;
  period!: PeriodDto;
  nastavniPlanId!: string;
  status!: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
}

export class CreateNastavnaGodinaDto {
  nastavnaGodina!: NastavnaGodinaDto;
  razredi!: RazredNastavnaGodinaDto[];
}









