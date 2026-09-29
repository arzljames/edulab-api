import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  REQUEST_SUPABASE_CLIENT,
  requestSupabaseClientProvider,
} from './request-supabase-client.provider';
import supabaseConfig from './supabase-config';
import {
  SUPABASE_CLIENT,
  supabaseClientProvider,
} from './supabase-client.provider';

const supabaseConfigModule = ConfigModule.forFeature(supabaseConfig);

/**
 * Shared Supabase infrastructure: config, the anon-key singleton client
 * (`SUPABASE_CLIENT`), the request-scoped, user-token client
 * (`REQUEST_SUPABASE_CLIENT`), and `JwtAuthGuard`. Any feature that talks
 * to Supabase or protects routes with Supabase Auth imports this module
 * rather than depending on another feature's internals.
 *
 * Not `@Global()` on purpose: each consuming module imports it explicitly
 * so its dependency on Supabase infrastructure is visible from the module
 * graph. Revisit as `@Global()` if the number of consumers makes the
 * repeated imports noisy.
 */
@Module({
  imports: [supabaseConfigModule],
  providers: [supabaseClientProvider, requestSupabaseClientProvider, JwtAuthGuard],
  exports: [
    supabaseConfigModule,
    SUPABASE_CLIENT,
    REQUEST_SUPABASE_CLIENT,
    JwtAuthGuard,
  ],
})
export class SharedSupabaseModule {}
