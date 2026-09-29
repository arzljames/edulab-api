import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { RequestWithUser } from '../guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Pulls the authenticated user off the request, as attached by
 * JwtAuthGuard. Usage: @CurrentUser() user: AuthenticatedUser, or
 * @CurrentUser('id') to pull a single property.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
