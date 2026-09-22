export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  role?: string;
  appMetadata: Record<string, unknown>;
  userMetadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  lastSignInAt?: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn?: number;
  expiresAt?: number;
  providerToken?: string | null;
  providerRefreshToken?: string | null;
}

export interface AuthSessionResponse {
  user: AuthUser | null;
  session: AuthSession | null;
}

export interface AuthRedirectResponse {
  url: string;
  provider?: string;
}

export interface SignOutResponse {
  signedOut: boolean;
  remoteSessionRevoked: boolean;
}
