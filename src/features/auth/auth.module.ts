import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { authConfigProvider } from './auth-config';
import { AuthService } from './auth.service';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { SupabaseAuthClient } from './supabase-auth.client';

@Module({
  controllers: [AuthController],
  providers: [
    authConfigProvider,
    AuthService,
    SupabaseAuthClient,
    SupabaseAuthGuard,
  ],
  exports: [AuthService, SupabaseAuthGuard],
})
export class AuthModule {}
