export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const authorization = request.headers.get('authorization');
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    return Response.json({ error: 'Starr calendar access is required.' }, { status: 403, headers });
  }
  try {
    // The function verifies the Starr session and current company access before reading HQ.
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/portfolio-calendar`, {
      headers: { authorization, accept: 'application/json' },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(35000),
    });
    if (response.status === 401 || response.status === 403) {
      return Response.json({ error: 'Starr calendar access is required.' }, { status: 403, headers });
    }
    if (!response.ok) throw new Error('Calendar unavailable');
    const payload = await response.json();
    if (!Array.isArray(payload.appointments)) throw new Error('Invalid calendar response');
    return Response.json({ appointments: payload.appointments }, { headers });
  } catch { return Response.json({ error: 'WorkForge HQ appointments could not be loaded.' }, { status: 503, headers }); }
}
