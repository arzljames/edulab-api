import type { Request } from 'express';
import type { AuthUser } from './auth-response.interface';

export interface AuthenticatedRequest extends Request {
  accessToken: string;
  user: AuthUser;
}
