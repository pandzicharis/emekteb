export class UpdateNapredakDto {
  napredak!: {
    [suraName: string]: number[]; // Array of learned ajeta numbers
  };
}
