import { SetMetadata } from '@nestjs/common';
import { Uloga } from '@prisma/client';

export const Roles = (...roles: Uloga[]) => SetMetadata('roles', roles);


