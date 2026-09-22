import type { Provider } from '@nestjs/common';

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');

export interface AuthConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
  supabaseServiceRoleKey?: string;
}

export const authConfigProvider: Provider<AuthConfig> = {
  provide: AUTH_CONFIG,
  useFactory: (): AuthConfig => ({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey:
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }),
};
