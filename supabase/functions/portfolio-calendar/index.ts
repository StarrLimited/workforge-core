import { createClient } from '@supabase/supabase-js';
import { verifyStarrPortfolioFeed } from '../../../lib/portfolio-feed-auth.ts';
import { hqAppointments } from '../../../lib/portfolio-appointments.ts';

const HQ_WORKSPACE_ID = '8ac08858-038c-41df-90a8-4a84f25cb400';

Deno.serve(async (request: Request) => {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (request.method !== 'GET') return Response.json({ error: 'Method not allowed.' }, { status: 405, headers });
  try {
    // The caller has a Starr JWT from a different Supabase project. Verify it with
    // Starr Auth and check the active profile and company access on every request.
    const identity = await verifyStarrPortfolioFeed(request.headers.get('authorization'));
    if (!identity) return Response.json({ error: 'Starr calendar access is required.' }, { status: 403, headers });
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const events: Parameters<typeof hqAppointments>[0] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from('hq_events')
        .select('id,title,owner,starts_at,ends_at,notes')
        .eq('workspace_id', HQ_WORKSPACE_ID).order('id').range(offset, offset + 499);
      if (error || !data) throw new Error('Calendar unavailable');
      events.push(...data);
      if (data.length < 500) break;
      if (offset >= 9500) throw new Error('Calendar capacity exceeded');
    }
    return Response.json({ appointments: hqAppointments(events, identity) }, { headers });
  } catch {
    return Response.json({ error: 'WorkForge HQ appointments could not be loaded.' }, { status: 503, headers });
  }
});
