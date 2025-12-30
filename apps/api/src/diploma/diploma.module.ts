import { Module } from '@nestjs/common';
import { DiplomaController } from './diploma.controller';
import { DiplomaService } from './diploma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DiplomaController],
  providers: [DiplomaService],
  exports: [DiplomaService],
})
export class DiplomaModule {}

