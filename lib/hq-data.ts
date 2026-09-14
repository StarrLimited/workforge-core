import { membership } from './data';
import { HQ_WORKSPACE_ID, type HQData } from './hq';

export async function loadHQ(): Promise<HQData> {
  const { db, role } = await membership(HQ_WORKSPACE_ID);
  const names = ['hq_accounts', 'hq_implementations', 'hq_tasks', 'hq_engagements', 'hq_events', 'audit_events', 'hq_support_plans', 'hq_tickets', 'hq_subscriptions', 'hq_ad_integrations', 'hq_ad_receipts'];
  const results = await Promise.all(names.map(name => db.from(name).select('*').eq('workspace_id', HQ_WORKSPACE_ID)
    .order(name === 'audit_events' ? 'created_at' : 'updated_at', { ascending: false }).limit(name === 'audit_events' ? 30 : 1000)));
  const failed = results.findIndex(r => r.error);
  if (failed !== -1) throw new Error(`Unable to load ${names[failed].replace('hq_', '').replaceAll('_', ' ')}. Please retry.`);
  if (results.some((r,i) => i !== 5 && i !== 10 && r.data?.length === 1000)) throw new Error('This workspace needs pagination before more records can be displayed. Contact your administrator.');
  return { role, accounts: results[0].data, implementations: results[1].data, tasks: results[2].data,
    engagements: results[3].data, events: results[4].data, activity: results[5].data,
    supportPlans: results[6].data, tickets: results[7].data, subscriptions: results[8].data, adIntegrations: results[9].data, adReceipts: results[10].data } as HQData;
}
