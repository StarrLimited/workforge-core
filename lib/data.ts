import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import type { DataSet, Role, Workspace } from './core';
export async function session() {
  const db = await createClient();
  const {data:{user},error} = await db.auth.getUser();
  if (error || !user) redirect('/login');
  return { db, user };
}
export async function membership(workspaceId:string) {
  const {db,user} = await session();
  const {data,error} = await db.from('workspace_memberships').select('role').eq('workspace_id',workspaceId).eq('user_id',user.id).eq('is_active',true).maybeSingle();
  if (error) throw new Error('Unable to verify workspace access. Please retry.');
  if (!data) throw new Error('You do not have access to this workspace.');
  return {db,user,role:data.role as Role};
}
export async function loadWorkspaces() {
  const {db} = await session();
  const {error: invitationError} = await db.rpc('accept_workspace_invitation');
  if (invitationError) throw new Error('Unable to check your invitation. Please retry.');
  const {data,error} = await db.from('workspaces').select('*').order('name');
  if (error) throw new Error('Unable to load workspaces. Please retry.');
  return (data ?? []) as Workspace[];
}
export async function loadWorkspace(workspaceId:string):Promise<DataSet> {
  const {db,role} = await membership(workspaceId);
  const tables = ['contacts','partners','work_orders','estimate_versions','tasks','appointments','purchase_orders','audit_events','file_records','pricebook_items','field_profiles','financial_records'] as const;
  const [workspace,...results] = await Promise.all([
    db.from('workspaces').select('*').eq('id',workspaceId).single(),
    ...tables.map(table => db.from(table).select('*').eq('workspace_id',workspaceId).order(table === 'audit_events' ? 'created_at' : table==='field_profiles'?'work_order_id':'id',{ascending:table!=='audit_events'}).limit(table==='audit_events'?100:1000))
  ]);
  if (workspace.error || results.some(x=>x.error)) throw new Error('Some workspace records could not be loaded. Please retry.');
  return {workspace:workspace.data as Workspace,role,contacts:results[0].data,partners:results[1].data,orders:results[2].data,estimates:results[3].data,tasks:results[4].data,appointments:results[5].data,purchases:results[6].data,activity:results[7].data,files:results[8].data,pricebook:results[9].data,profiles:results[10].data,financials:results[11].data} as DataSet;
}
