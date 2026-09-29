/**
 * Pulls the token out of an `Authorization: Bearer <token>` header value.
 * Returns null if the header is missing, malformed, or uses a different
 * scheme. Shared by `JwtAuthGuard` and `REQUEST_SUPABASE_CLIENT` so both
 * parse the header the same way.
 */
export function extractBearerToken(
  authorization: string | undefined,
): string | null {
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}
