import type { Role } from './core';
export type HQTeam = {
  members: { user_id: string; email: string; role: Role; is_active: boolean }[];
  invitations: { id: string; email: string; role: Role; expires_at: string }[];
};
export type LeadRelay = { provider: 'meta' | 'google_ads'; enabled: boolean; default_owner: string; page_id: string; form_ids: string[]; last_received_at: string | null; last_test_at: string | null };
