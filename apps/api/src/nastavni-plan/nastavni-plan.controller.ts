import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { NastavniPlanService } from './nastavni-plan.service';

@Controller('nastavni-plan')
export class NastavniPlanController {
  constructor(private readonly nastavniPlanService: NastavniPlanService) {}

  @Post()
  create(@Body() payload: any) {
    return this.nastavniPlanService.save(payload);
  }

  @Get()
  findAll() {
    return this.nastavniPlanService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.nastavniPlanService.findOne(id);
  }
}










