/** Keep sign-in on the portal that initiated it, including preview deployments.
 * Never use NEXT_PUBLIC_APP_URL or user-supplied redirect query parameters here:
 * a different origin would also lose the browser's host-scoped session cookies.
 */
export function signInCallbackUrl(portalUrl: string): string {
  return new URL('/auth/callback', new URL(portalUrl).origin).href;
}

export function authRedirectUrl(requestUrl: string, authenticated: boolean): URL {
  return new URL(authenticated ? '/' : '/login?error=callback', new URL(requestUrl).origin);
}
