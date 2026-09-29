import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { JwtAuthGuard, type RequestWithUser } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let supabase: { auth: { getUser: jest.Mock } };
  let guard: JwtAuthGuard;

  const mockUser = {
    id: 'user-1',
    email: 'student@edulab.dev',
  } as User;

  function createContext(authorization?: string): {
    context: ExecutionContext;
    request: Partial<RequestWithUser>;
  } {
    const request: Partial<RequestWithUser> = {
      headers: authorization ? { authorization } : {},
    } as Partial<RequestWithUser>;

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    return { context, request };
  }

  beforeEach(() => {
    supabase = { auth: { getUser: jest.fn() } };
    guard = new JwtAuthGuard(supabase as never);
  });

  it('allows the request and attaches the user when the token is valid', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    const { context, request } = createContext('Bearer valid-token');

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(supabase.auth.getUser).toHaveBeenCalledWith('valid-token');
    expect(request.user).toEqual({
      id: mockUser.id,
      email: mockUser.email,
      accessToken: 'valid-token',
    });
  });

  it('throws UnauthorizedException when the Authorization header is missing', async () => {
    const { context } = createContext(undefined);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the header has no Bearer scheme', async () => {
    const { context } = createContext('Basic sometoken');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the Bearer scheme has no token', async () => {
    const { context } = createContext('Bearer');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when Supabase returns an error', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid token' },
    });
    const { context } = createContext('Bearer bad-token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when Supabase returns no user', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const { context } = createContext('Bearer bad-token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
