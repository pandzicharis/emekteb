import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Uloga } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // @Roles() na metodi ima prednost, ali se čita i sa kontrolera (cijeli kontroler zaštićen).
    const requiredRoles = this.reflector.getAllAndOverride<Uloga[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user || !user.uloga) {
      return false;
    }
    
    return requiredRoles.some((role) => user.uloga === role);
  }
}







