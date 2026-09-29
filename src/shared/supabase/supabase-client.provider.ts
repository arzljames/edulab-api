import type { Provider } from '@nestjs/common';
import { InternalServerErrorException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import supabaseConfig from './supabase-config';

export const SUPABASE_CLIENT = Symbol('SUPABASE_CLIENT');

/**
 * Anon-key singleton client with no user session attached. Only suitable
 * for calls that don't need `auth.uid()` to resolve under RLS (Supabase
 * Auth calls such as signUp/signInWithPassword/refreshSession/getUser).
 * Any query against an RLS-protected table must use
 * `REQUEST_SUPABASE_CLIENT` instead — see `request-supabase-client.provider.ts`.
 */
export const supabaseClientProvider: Provider<SupabaseClient<Database>> = {
  provide: SUPABASE_CLIENT,
  inject: [supabaseConfig.KEY],
  useFactory: (
    config: ConfigType<typeof supabaseConfig>,
  ): SupabaseClient<Database> => buildSupabaseClient(config),
};

function assertConfigured(
  config: ConfigType<typeof supabaseConfig>,
): asserts config is { url: string; anonKey: string } {
  if (!config.url || !config.anonKey) {
    throw new InternalServerErrorException(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.',
    );
  }
}

export function buildSupabaseClient(
  config: ConfigType<typeof supabaseConfig>,
  accessToken?: string,
): SupabaseClient<Database> {
  assertConfigured(config);

  return createClient<Database>(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    ...(accessToken && {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    }),
  });
}

/**
 * Builds a short-lived client scoped to a specific user's access token —
 * e.g. to revoke that user's session, or (via
 * `request-supabase-client.provider.ts`) to run RLS-protected queries as
 * that user.
 */
export function createScopedSupabaseClient(
  config: ConfigType<typeof supabaseConfig>,
  accessToken: string,
): SupabaseClient<Database> {
  return buildSupabaseClient(config, accessToken);
}
