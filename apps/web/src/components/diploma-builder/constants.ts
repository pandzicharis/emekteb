import { DiplomaType } from './types';

export const DIPLOMA_TYPES: DiplomaType[] = [
  {
    id: 'DOBRI_REZULTATI',
    name: 'Dobri rezultati',
    description: 'Diploma za dobre rezultate u nastavi',
    customFields: [
      {
        id: 'nastavna_godina',
        label: 'Nastavna godina',
        type: 'text',
        required: true,
        placeholder: 'npr. 2024/2025',
      },
      {
        id: 'datum',
        label: 'Datum',
        type: 'date',
        required: true,
      },
    ],
  },
  {
    id: 'ILMIHAL',
    name: 'Ilmihal',
    description: 'Diploma za završetak ilmihal programa',
    customFields: [
      {
        id: 'nastavna_godina',
        label: 'Nastavna godina',
        type: 'text',
        required: true,
        placeholder: 'npr. 2024/2025',
      },
      {
        id: 'nivo',
        label: 'Nivo',
        type: 'text',
        required: true,
        placeholder: 'npr. 1, 2, 3',
      },
      {
        id: 'datum',
        label: 'Datum',
        type: 'date',
        required: true,
      },
    ],
  },
  {
    id: 'NAJREDOVNIJI_UCENIK',
    name: 'Najredovniji učenik',
    description: 'Diploma za najredovnijeg učenika',
    customFields: [
      {
        id: 'nastavna_godina',
        label: 'Nastavna godina',
        type: 'text',
        required: true,
        placeholder: 'npr. 2024/2025',
      },
      {
        id: 'datum',
        label: 'Datum',
        type: 'date',
        required: true,
      },
    ],
  },
  {
    id: 'POSEBAN_DOPRINOS_I_ZALAGANJE',
    name: 'Poseban doprinos i zalaganje',
    description: 'Diploma za poseban doprinos i zalaganje',
    customFields: [
      {
        id: 'nastavna_godina',
        label: 'Nastavna godina',
        type: 'text',
        required: true,
        placeholder: 'npr. 2024/2025',
      },
      {
        id: 'datum',
        label: 'Datum',
        type: 'date',
        required: true,
      },
    ],
  },
  {
    id: 'SUFARA',
    name: 'Sufara',
    description: 'Diploma za završene sufara lekcije',
    customFields: [
      {
        id: 'nastavna_godina',
        label: 'Nastavna godina',
        type: 'text',
        required: true,
        placeholder: 'npr. 2024/2025',
      },
      {
        id: 'datum',
        label: 'Datum',
        type: 'date',
        required: true,
      },
    ],
  },
  {
    id: 'TAKMICENJE',
    name: 'Takmičenje',
    description: 'Diploma za učešće ili plasman na takmičenju',
    customFields: [
      {
        id: 'godina',
        label: 'Godina',
        type: 'text',
        required: true,
        placeholder: 'npr. 2024/2025',
      },
      {
        id: 'kategorija',
        label: 'Kategorija',
        type: 'text',
        required: true,
        placeholder: 'npr. Kuran, Ilmihal, itd.',
      },
      {
        id: 'datum',
        label: 'Datum',
        type: 'date',
        required: true,
      },
    ],
  },
];

export function getDiplomaTypeById(id: string): DiplomaType | undefined {
  return DIPLOMA_TYPES.find((type) => type.id === id);
}

