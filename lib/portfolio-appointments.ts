export type AppointmentIdentity = { email: string; fullName: string };
export function isMyAppointment(owner: unknown, identity: AppointmentIdentity) {
  if (typeof owner !== 'string' || !owner.trim()) return false;
  const normalize = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ');
  const names = [identity.email, identity.fullName].filter(Boolean).map(normalize);
  if (normalize(identity.email) === 'shawn@starrlimited.com') names.push('shawn', 'shawn starr');
  return names.includes(normalize(owner));
}

type HQCalendarEvent = { id: string; title: string; owner: string; starts_at: string; ends_at: string; notes: string };
export function hqAppointments(events: HQCalendarEvent[], identity: AppointmentIdentity) {
  return events.filter(e => isMyAppointment(e.owner, identity)).map(e => ({
    id: e.id, title: e.title, start: e.starts_at, end: e.ends_at || '', owner: e.owner,
    location: '', detail: e.notes || '', status: 'Scheduled',
    url: `https://workforge-development.vercel.app/hq?section=calendar&record=${encodeURIComponent(e.id)}`,
  }));
}
