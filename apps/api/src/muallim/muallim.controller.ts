import { Controller, Get } from '@nestjs/common';
import { MuallimService } from './muallim.service';

@Controller('muallimi')
export class MuallimController {
  constructor(private readonly muallimService: MuallimService) {}

  @Get()
  findAll() {
    return this.muallimService.findAll();
  }
}

