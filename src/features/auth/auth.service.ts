import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Provider, Session, User } from '@supabase/supabase-js';
import type { RefreshSessionDto } from './dto/refresh-session.dto';
import type { SignInWithOAuthDto } from './dto/sign-in-with-oauth.dto';
import type { SignInWithPasswordDto } from './dto/sign-in-with-password.dto';
import type { SignInWithSsoDto } from './dto/sign-in-with-sso.dto';
import type { SignUpWithPasswordDto } from './dto/sign-up-with-password.dto';
import type {
  AuthRedirectResponse,
  AuthSession,
  AuthSessionResponse,
  AuthUser,
  SignOutResponse,
} from './interfaces/auth-response.interface';
import { SupabaseAuthClient } from './supabase-auth.client';

type SupabaseAuthError = {
  message?: string;
  status?: number;
};

@Injectable()
export class AuthService {
  constructor(private readonly supabaseAuth: SupabaseAuthClient) {}

  async signUpWithPassword(
    dto: SignUpWithPasswordDto,
  ): Promise<AuthSessionResponse> {
    const email = this.requireString(dto?.email, 'email');
    const password = this.requireString(dto?.password, 'password');

    const { data, error } = await this.supabaseAuth.client.auth.signUp({
      email,
      password,
      options: {
        data: dto?.metadata,
        emailRedirectTo: dto?.redirectTo,
      },
    });

    this.throwIfAuthError(error);

    return this.toSessionResponse(data.user, data.session);
  }

  async signInWithPassword(
    dto: SignInWithPasswordDto,
  ): Promise<AuthSessionResponse> {
    const email = this.requireString(dto?.email, 'email');
    const password = this.requireString(dto?.password, 'password');

    const { data, error } =
      await this.supabaseAuth.client.auth.signInWithPassword({
        email,
        password,
      });

    this.throwIfAuthError(error);

    return this.toSessionResponse(data.user, data.session);
  }

  async signInWithOAuth(
    dto: SignInWithOAuthDto,
  ): Promise<AuthRedirectResponse> {
    const provider = this.requireString(dto?.provider, 'provider');

    const { data, error } =
      await this.supabaseAuth.client.auth.signInWithOAuth({
        provider: provider as Provider,
        options: {
          redirectTo: dto?.redirectTo,
          scopes: dto?.scopes,
          queryParams: dto?.queryParams,
          skipBrowserRedirect: true,
        },
      });

    this.throwIfAuthError(error);

    if (!data.url) {
      throw new BadRequestException('Supabase did not return an OAuth URL.');
    }

    return {
      provider,
      url: data.url,
    };
  }

  async signInWithSso(dto: SignInWithSsoDto): Promise<AuthRedirectResponse> {
    if (!dto?.domain && !dto?.providerId) {
      throw new BadRequestException('domain or providerId is required.');
    }

    const credentials = dto.providerId
      ? {
          providerId: dto.providerId,
          options: {
            redirectTo: dto?.redirectTo,
            skipBrowserRedirect: true,
          },
        }
      : {
          domain: this.requireString(dto.domain, 'domain'),
          options: {
            redirectTo: dto?.redirectTo,
            skipBrowserRedirect: true,
          },
        };

    const { data, error } =
      await this.supabaseAuth.client.auth.signInWithSSO(credentials);

    this.throwIfAuthError(error);

    if (!data?.url) {
      throw new BadRequestException('Supabase did not return an SSO URL.');
    }

    return {
      url: data.url,
    };
  }

  async refreshSession(dto: RefreshSessionDto): Promise<AuthSessionResponse> {
    const refreshToken = this.requireString(dto?.refreshToken, 'refreshToken');

    const { data, error } =
      await this.supabaseAuth.client.auth.refreshSession({
        refresh_token: refreshToken,
      });

    this.throwIfAuthError(error);

    return this.toSessionResponse(data.user, data.session);
  }

  async getUser(accessToken: string): Promise<AuthUser> {
    const { data, error } =
      await this.supabaseAuth.client.auth.getUser(accessToken);

    if (error || !data.user) {
      throw new UnauthorizedException(error?.message ?? 'Invalid auth token.');
    }

    return this.toUser(data.user);
  }

  async signOut(accessToken: string): Promise<SignOutResponse> {
    const admin = this.supabaseAuth.admin;

    if (!admin) {
      return {
        signedOut: true,
        remoteSessionRevoked: false,
      };
    }

    const { error } = await admin.auth.admin.signOut(accessToken);

    this.throwIfAuthError(error);

    return {
      signedOut: true,
      remoteSessionRevoked: true,
    };
  }

  private requireString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${fieldName} is required.`);
    }

    return value.trim();
  }

  private throwIfAuthError(error: SupabaseAuthError | null): void {
    if (!error) {
      return;
    }

    if (error.status === 401 || error.status === 403) {
      throw new UnauthorizedException(error.message);
    }

    throw new BadRequestException(error.message);
  }

  private toSessionResponse(
    user: User | null,
    session: Session | null,
  ): AuthSessionResponse {
    return {
      user: user ? this.toUser(user) : null,
      session: session ? this.toSession(session) : null,
    };
  }

  private toUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      appMetadata: user.app_metadata,
      userMetadata: user.user_metadata,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastSignInAt: user.last_sign_in_at,
    };
  }

  private toSession(session: Session): AuthSession {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      tokenType: session.token_type,
      expiresIn: session.expires_in,
      expiresAt: session.expires_at,
      providerToken: session.provider_token,
      providerRefreshToken: session.provider_refresh_token,
    };
  }
}
