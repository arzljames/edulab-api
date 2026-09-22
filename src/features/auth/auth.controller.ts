import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { SignInWithOAuthDto } from './dto/sign-in-with-oauth.dto';
import { SignInWithPasswordDto } from './dto/sign-in-with-password.dto';
import { SignInWithSsoDto } from './dto/sign-in-with-sso.dto';
import { SignUpWithPasswordDto } from './dto/sign-up-with-password.dto';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import type {
  AuthRedirectResponse,
  AuthSessionResponse,
  AuthUser,
  SignOutResponse,
} from './interfaces/auth-response.interface';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('password/sign-up')
  signUpWithPassword(
    @Body() dto: SignUpWithPasswordDto,
  ): Promise<AuthSessionResponse> {
    return this.authService.signUpWithPassword(dto);
  }

  @Post('password/sign-in')
  signInWithPassword(
    @Body() dto: SignInWithPasswordDto,
  ): Promise<AuthSessionResponse> {
    return this.authService.signInWithPassword(dto);
  }

  @Post('oauth/sign-in')
  signInWithOAuth(
    @Body() dto: SignInWithOAuthDto,
  ): Promise<AuthRedirectResponse> {
    return this.authService.signInWithOAuth(dto);
  }

  @Post('sso/sign-in')
  signInWithSso(@Body() dto: SignInWithSsoDto): Promise<AuthRedirectResponse> {
    return this.authService.signInWithSso(dto);
  }

  @Post('token/refresh')
  refreshSession(@Body() dto: RefreshSessionDto): Promise<AuthSessionResponse> {
    return this.authService.refreshSession(dto);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('sign-out')
  signOut(@Req() request: AuthenticatedRequest): Promise<SignOutResponse> {
    return this.authService.signOut(request.accessToken);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
