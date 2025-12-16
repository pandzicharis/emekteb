import { Body, Controller, Post, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('pin')
  async loginWithPin(@Body() body: { pin: string; userId?: string }) {
    this.logger.debug(`📥 Received PIN login request: ${body.userId ? `userId=${body.userId}` : 'pin only'}`);
    return this.authService.loginWithPin(body.pin, body.userId);
  }
}




