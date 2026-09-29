import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../shared/auth/interfaces/authenticated-user.interface';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { CurrentUserDto } from './dto/current-user.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SignUpDto } from './dto/sign-up.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a new account with email and password.' })
  @ApiCreatedResponse({
    description: 'Account created and session issued.',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed.' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Email already registered.' })
  async signUp(@Body() dto: SignUpDto): Promise<AuthResponseDto> {
    return this.authService.signUp(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Authenticate with email and password.' })
  @ApiOkResponse({
    description: 'Authenticated successfully.',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid credentials.' })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Exchange a refresh token for a new session.' })
  @ApiOkResponse({
    description: 'Session refreshed successfully.',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid or expired refresh token.' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "End the authenticated user's session." })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Session ended.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Missing or invalid bearer token.' })
  async logout(@CurrentUser('accessToken') accessToken: string): Promise<void> {
    return this.authService.logout(accessToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the currently authenticated user.' })
  @ApiOkResponse({
    description: 'The authenticated user.',
    type: CurrentUserDto,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Missing or invalid bearer token.' })
  async getMe(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CurrentUserDto> {
    return this.authService.getMe(user);
  }
}
