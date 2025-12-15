export interface RasporedItem {
  id: string;
  grupa: {
    id: string;
    naziv: string;
    razred: {
      id: string;
      name: string;
      ilmihal: string;
    };
    kuran: boolean;
    sufara: boolean;
    brojUcenika: number;
    ucenici?: { id: string; ime: string; prezime: string; godinaRodjenja?: number | null }[];
  };
  dan: string;
  slot: string;
  lokacija: string | null;
  trajanje: number;
  startTime: string;
  endTime: string;
}

