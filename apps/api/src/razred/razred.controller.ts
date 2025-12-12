import { Controller, Get } from '@nestjs/common';
import { RazredService } from './razred.service';

@Controller('razredi')
export class RazredController {
  constructor(private readonly razredService: RazredService) {}

  @Get()
  findAll() {
    return this.razredService.findAll();
  }
}





