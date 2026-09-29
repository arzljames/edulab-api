import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Request } from 'express';
import { SUPABASE_CLIENT } from '../../supabase/supabase-client.provider';
import type { Database } from '../../supabase/database.types';
import { extractBearerToken } from '../utils/extract-bearer-token';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

/**
 * Validates the Supabase-issued bearer JWT on the incoming request and
 * attaches the authenticated user to it. Shared infrastructure — any
 * feature can `@UseGuards(JwtAuthGuard)` to protect a route. Always
 * validates against the anon-key `SUPABASE_CLIENT`, never the
 * request-scoped client (there is no request-scoped client to depend on
 * yet at the point the token itself is being validated).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient<Database>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const { data, error } = await this.supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired token.');
    }

    request.user = {
      id: data.user.id,
      email: data.user.email,
      accessToken: token,
    };

    return true;
  }
}
