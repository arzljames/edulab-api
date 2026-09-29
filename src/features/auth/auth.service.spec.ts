import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import supabaseConfig from '../../shared/supabase/supabase-config';
import {
  createScopedSupabaseClient,
  SUPABASE_CLIENT,
} from '../../shared/supabase/supabase-client.provider';
import { AuthService } from './auth.service';

jest.mock('../../shared/supabase/supabase-client.provider', () => ({
  ...jest.requireActual('../../shared/supabase/supabase-client.provider'),
  createScopedSupabaseClient: jest.fn(),
}));

const mockedCreateScopedSupabaseClient =
  createScopedSupabaseClient as jest.MockedFunction<
    typeof createScopedSupabaseClient
  >;

describe('AuthService', () => {
  let service: AuthService;
  let supabase: {
    auth: {
      signUp: jest.Mock;
      signInWithPassword: jest.Mock;
      refreshSession: jest.Mock;
    };
  };
  let config: ConfigType<typeof supabaseConfig>;

  const mockUser = {
    id: 'user-1',
    email: 'student@edulab.dev',
  } as User;

  const mockSession = {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_at: 1732384421,
    expires_in: 3600,
    token_type: 'bearer',
    user: mockUser,
  } as Session;

  beforeEach(async () => {
    supabase = {
      auth: {
        signUp: jest.fn(),
        signInWithPassword: jest.fn(),
        refreshSession: jest.fn(),
      },
    };
    config = { url: 'https://project.supabase.co', anonKey: 'anon-key' };

    mockedCreateScopedSupabaseClient.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: SUPABASE_CLIENT, useValue: supabase },
        { provide: supabaseConfig.KEY, useValue: config },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('signUp', () => {
    it('maps a successful sign up to an AuthResponseDto', async () => {
      supabase.auth.signUp.mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: null,
      });

      const result = await service.signUp({
        email: mockUser.email!,
        password: 'Str0ngPassword!',
      });

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: mockUser.email,
        password: 'Str0ngPassword!',
      });
      expect(result).toEqual({
        accessToken: mockSession.access_token,
        refreshToken: mockSession.refresh_token,
        expiresAt: mockSession.expires_at,
        user: { id: mockUser.id, email: mockUser.email },
      });
    });

    it('throws ConflictException when Supabase reports status 422', async () => {
      supabase.auth.signUp.mockResolvedValue({
        data: { session: null, user: null },
        error: { status: 422, message: 'Email already registered' },
      });

      await expect(
        service.signUp({ email: 'dup@edulab.dev', password: 'password123' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws ConflictException when Supabase reports code user_already_exists', async () => {
      supabase.auth.signUp.mockResolvedValue({
        data: { session: null, user: null },
        error: { status: 400, code: 'user_already_exists', message: 'exists' },
      });

      await expect(
        service.signUp({ email: 'dup@edulab.dev', password: 'password123' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws BadRequestException for other Supabase errors', async () => {
      supabase.auth.signUp.mockResolvedValue({
        data: { session: null, user: null },
        error: { status: 400, message: 'Weak password' },
      });

      await expect(
        service.signUp({ email: 'new@edulab.dev', password: 'password123' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws UnprocessableEntityException when email confirmation is required', async () => {
      supabase.auth.signUp.mockResolvedValue({
        data: { session: null, user: mockUser },
        error: null,
      });

      await expect(
        service.signUp({ email: mockUser.email!, password: 'password123' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('login', () => {
    it('maps a successful login to an AuthResponseDto', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: null,
      });

      const result = await service.login({
        email: mockUser.email!,
        password: 'Str0ngPassword!',
      });

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: mockUser.email,
        password: 'Str0ngPassword!',
      });
      expect(result.accessToken).toBe(mockSession.access_token);
      expect(result.user).toEqual({ id: mockUser.id, email: mockUser.email });
    });

    it('throws UnauthorizedException when Supabase returns an error', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: { status: 400, message: 'Invalid login credentials' },
      });

      await expect(
        service.login({ email: 'wrong@edulab.dev', password: 'badpass' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when session or user is missing without an error', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: null,
      });

      await expect(
        service.login({ email: 'wrong@edulab.dev', password: 'badpass' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('maps a successful refresh to an AuthResponseDto', async () => {
      supabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: null,
      });

      const result = await service.refresh({ refreshToken: 'refresh-token' });

      expect(supabase.auth.refreshSession).toHaveBeenCalledWith({
        refresh_token: 'refresh-token',
      });
      expect(result.refreshToken).toBe(mockSession.refresh_token);
    });

    it('throws UnauthorizedException when Supabase returns an error', async () => {
      supabase.auth.refreshSession.mockResolvedValue({
        data: { session: null, user: null },
        error: { status: 401, message: 'Invalid refresh token' },
      });

      await expect(
        service.refresh({ refreshToken: 'bad-token' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when session or user is missing without an error', async () => {
      supabase.auth.refreshSession.mockResolvedValue({
        data: { session: null, user: null },
        error: null,
      });

      await expect(
        service.refresh({ refreshToken: 'bad-token' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes the session via admin.signOut on a scoped client', async () => {
      const adminSignOut = jest.fn().mockResolvedValue({ error: null });
      mockedCreateScopedSupabaseClient.mockReturnValue({
        auth: { admin: { signOut: adminSignOut } },
      } as unknown as SupabaseClient);

      await service.logout('a-users-access-token');

      expect(createScopedSupabaseClient).toHaveBeenCalledWith(
        config,
        'a-users-access-token',
      );
      expect(adminSignOut).toHaveBeenCalledWith(
        'a-users-access-token',
        'global',
      );
    });

    it('throws InternalServerErrorException when the scoped sign out fails', async () => {
      const adminSignOut = jest
        .fn()
        .mockResolvedValue({ error: { message: 'boom' } });
      mockedCreateScopedSupabaseClient.mockReturnValue({
        auth: { admin: { signOut: adminSignOut } },
      } as unknown as SupabaseClient);

      await expect(
        service.logout('a-users-access-token'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('getMe', () => {
    it('maps the authenticated user to a CurrentUserDto', async () => {
      const result = await service.getMe({
        id: 'user-1',
        email: 'student@edulab.dev',
        accessToken: 'token',
      });

      expect(result).toEqual({ id: 'user-1', email: 'student@edulab.dev' });
    });

    it('falls back to an empty string when email is missing', async () => {
      const result = await service.getMe({
        id: 'user-1',
        accessToken: 'token',
      });

      expect(result).toEqual({ id: 'user-1', email: '' });
    });
  });

  describe('toAuthResponse expiresAt fallback', () => {
    it('computes expiresAt from expires_in when expires_at is missing', async () => {
      const now = 1_700_000_000_000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const sessionWithoutExpiresAt = {
        ...mockSession,
        expires_at: undefined,
        expires_in: 3600,
      } as unknown as Session;

      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: sessionWithoutExpiresAt, user: mockUser },
        error: null,
      });

      const result = await service.login({
        email: mockUser.email!,
        password: 'Str0ngPassword!',
      });

      expect(result.expiresAt).toBe(Math.floor(now / 1000) + 3600);
    });
  });
});
