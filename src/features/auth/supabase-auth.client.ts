import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AUTH_CONFIG, type AuthConfig } from './auth-config';

@Injectable()
export class SupabaseAuthClient {
  private userClient?: SupabaseClient;
  private adminClient?: SupabaseClient;

  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  get client(): SupabaseClient {
    if (!this.userClient) {
      const { supabaseUrl, supabaseKey } = this.requireClientConfig();

      this.userClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      });
    }

    return this.userClient;
  }

  get admin(): SupabaseClient | null {
    const { supabaseUrl, supabaseServiceRoleKey } = this.config;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return null;
    }

    this.adminClient ??= createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });

    return this.adminClient;
  }

  private requireClientConfig(): {
    supabaseUrl: string;
    supabaseKey: string;
  } {
    const { supabaseUrl, supabaseKey } = this.config;

    if (!supabaseUrl || !supabaseKey) {
      throw new InternalServerErrorException(
        'Supabase auth is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.',
      );
    }

    return { supabaseUrl, supabaseKey };
  }
}
