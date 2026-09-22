export class SignUpWithPasswordDto {
  email: string;
  password: string;
  redirectTo?: string;
  metadata?: Record<string, unknown>;
}
