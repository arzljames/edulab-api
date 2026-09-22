export class SignInWithOAuthDto {
  provider: string;
  redirectTo?: string;
  scopes?: string;
  queryParams?: Record<string, string>;
}
