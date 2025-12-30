import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class GenerateDiplomaDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  ime_prezime: string;

  @IsString()
  @IsNotEmpty()
  datum: string;

  @IsString()
  @IsOptional()
  nastavna_godina?: string;

  @IsString()
  @IsOptional()
  nivo?: string;

  @IsString()
  @IsOptional()
  kategorija?: string;

  @IsString()
  @IsOptional()
  godina?: string;
}

export class GenerateBatchDiplomaDto {
  students: Array<{
    type: string;
    ime_prezime: string;
    datum: string;
    nastavna_godina?: string;
    nivo?: string;
    kategorija?: string;
    godina?: string;
  }>;
}


