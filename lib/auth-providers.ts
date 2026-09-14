/** Read the project's enabled provider, so its settings are the source of truth. */
export async function googleSignInEnabled({
  supabaseUrl, publishableKey, fetcher = fetch,
}: { supabaseUrl?: string; publishableKey?: string; fetcher?: typeof fetch }): Promise<boolean> {
  if (!supabaseUrl || !publishableKey) return false;
  try {
    const response = await fetcher(new URL('/auth/v1/settings', supabaseUrl), {
      headers: { apikey: publishableKey }, cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const settings = await response.json();
    return settings?.external?.google === true;
  } catch { return false; }
}
