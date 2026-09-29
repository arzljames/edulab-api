import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { AuthenticatedUser } from '../../shared/auth/interfaces/authenticated-user.interface';
import type { Database } from '../../shared/supabase/database.types';
import supabaseConfig from '../../shared/supabase/supabase-config';
import {
  createScopedSupabaseClient,
  SUPABASE_CLIENT,
} from '../../shared/supabase/supabase-client.provider';
import type { AuthResponseDto } from './dto/auth-response.dto';
import type { CurrentUserDto } from './dto/current-user.dto';
import type { LoginDto } from './dto/login.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';
import type { SignUpDto } from './dto/sign-up.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient<Database>,
    @Inject(supabaseConfig.KEY)
    private readonly config: ConfigType<typeof supabaseConfig>,
  ) {}

  async signUp(dto: SignUpDto): Promise<AuthResponseDto> {
    const { data, error } = await this.supabase.auth.signUp({
      email: dto.email,
      password: dto.password,
    });

    if (error) {
      this.logger.warn(`Sign up failed for ${dto.email}: ${error.message}`);

      if (error.status === 422 || error.code === 'user_already_exists') {
        throw new ConflictException('An account with this email already exists.');
      }

      throw new BadRequestException(error.message);
    }

    if (!data.session || !data.user) {
      throw new UnprocessableEntityException(
        'Account created. Check your email to confirm your account before logging in.',
      );
    }

    return this.toAuthResponse(data.session, data.user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });

    if (error || !data.session || !data.user) {
      this.logger.warn(`Login failed for ${dto.email}: ${error?.message}`);
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.toAuthResponse(data.session, data.user);
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthResponseDto> {
    const { data, error } = await this.supabase.auth.refreshSession({
      refresh_token: dto.refreshToken,
    });

    if (error || !data.session || !data.user) {
      this.logger.warn(`Session refresh failed: ${error?.message}`);
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    return this.toAuthResponse(data.session, data.user);
  }

  async logout(accessToken: string): Promise<void> {
    // A plain `auth.signOut()` reads the session from the client's internal
    // storage, which is always empty here (persistSession: false, no session
    // was ever loaded into this scoped client). Revoking a specific token's
    // session requires the lower-level endpoint, invoked explicitly with the
    // token — this does not require the service-role key, only the caller's
    // own valid JWT.
    const scopedClient = createScopedSupabaseClient(this.config, accessToken);
    const { error } = await scopedClient.auth.admin.signOut(
      accessToken,
      'global',
    );

    if (error) {
      this.logger.error(`Logout failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to end the session.');
    }
  }

  async getMe(user: AuthenticatedUser): Promise<CurrentUserDto> {
    return { id: user.id, email: user.email ?? '' };
  }

  private toAuthResponse(session: Session, user: User): AuthResponseDto {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt:
        session.expires_at ??
        Math.floor(Date.now() / 1000) + session.expires_in,
      user: {
        id: user.id,
        email: user.email ?? '',
      },
    };
  }
}
