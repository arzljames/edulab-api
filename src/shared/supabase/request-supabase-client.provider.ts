import type { Provider } from '@nestjs/common';
import { Scope } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { REQUEST } from '@nestjs/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Request } from 'express';
import { extractBearerToken } from '../auth/utils/extract-bearer-token';
import type { Database } from './database.types';
import supabaseConfig from './supabase-config';
import { buildSupabaseClient } from './supabase-client.provider';

export const REQUEST_SUPABASE_CLIENT = Symbol('REQUEST_SUPABASE_CLIENT');

/**
 * Request-scoped Supabase client carrying the *calling request's* bearer
 * token as its Authorization header, so `(select auth.uid())` in RLS
 * policies resolves to the real signed-in user. Use this — never
 * `SUPABASE_CLIENT` — for any query against an RLS-protected table.
 *
 * When the request has no (or an invalid-looking) bearer token, this falls
 * back to a plain anon-key client with no user attached, so `auth.uid()`
 * resolves to null under RLS. That keeps this provider usable on public
 * routes too (e.g. `GET /resources`), where anonymous callers should still
 * only see rows RLS allows for an anonymous role.
 *
 * Injecting this token makes the injecting provider request-scoped as
 * well; Nest propagates DI scope automatically, no `@Injectable({ scope })`
 * needed on the consuming service.
 */
export const requestSupabaseClientProvider: Provider<SupabaseClient<Database>> =
  {
    provide: REQUEST_SUPABASE_CLIENT,
    scope: Scope.REQUEST,
    inject: [REQUEST, supabaseConfig.KEY],
    useFactory: (
      request: Request,
      config: ConfigType<typeof supabaseConfig>,
    ): SupabaseClient<Database> => {
      const token = extractBearerToken(request.headers.authorization);

      return buildSupabaseClient(config, token ?? undefined);
    },
  };
