import { registerAs } from '@nestjs/config';

export interface SupabaseConfig {
  url?: string;
  anonKey?: string;
}

/**
 * Shared Supabase configuration, read once from the environment. Any
 * feature that needs a Supabase client (directly, or via
 * `SharedSupabaseModule`) injects this instead of re-registering its own
 * copy or reading `process.env` directly.
 */
export default registerAs(
  'supabase',
  (): SupabaseConfig => ({
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
  }),
);
