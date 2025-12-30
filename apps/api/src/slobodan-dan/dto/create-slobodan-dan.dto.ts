import { IsString, IsNotEmpty, IsDateString, MinLength } from 'class-validator';

export class CreateSlobodanDanDto {
  @IsString()
  @IsNotEmpty()
  nastavnaGodinaId: string;

  @IsDateString()
  @IsNotEmpty()
  datum: string; // ISO string format

  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Razlog mora imati najmanje 3 karaktera' })
  razlog: string;
}

export class UpdateSlobodanDanDto {
  @IsDateString()
  datum?: string; // ISO string format

  @IsString()
  @MinLength(3, { message: 'Razlog mora imati najmanje 3 karaktera' })
  razlog?: string;
}



