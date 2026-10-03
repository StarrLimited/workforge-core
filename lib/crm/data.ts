import { membership } from '../data';
import type { Workspace } from '../core';
import type { CRMData } from './types';
export async function loadCRM(workspace:Workspace,workspaces:Workspace[]):Promise<CRMData> {
 const {db,user,role}=await membership(workspace.id);
 const tables=['crm_companies','crm_contacts','crm_pipelines','crm_stages','crm_deals','crm_activities','crm_notes','crm_history'] as const;
 // Fetch every page so reports never silently omit records after Supabase's row limit.
 async function all(table:typeof tables[number]) {
  const rows:unknown[]=[];let page=0;
  for(;;){const {data,error}=await db.from(table).select('*').eq('workspace_id',workspace.id).order('id').range(page*1000,page*1000+999);if(error)throw new Error('CRM data could not be loaded. Please retry.');rows.push(...data);if(data.length<1000)break;page++;}
  return rows;
 }
 const [companies,contacts,pipelines,stages,deals,activities,notes,history,team]=await Promise.all([...tables.map(all),db.rpc('crm_team',{w:workspace.id})]);
 const directory=team as {data:unknown;error:unknown};if(directory.error)throw new Error('Unable to load the CRM team.');
 return {workspace,workspaces,role,userId:user.id,companies,contacts,pipelines,stages,deals,activities,notes,history,team:directory.data,loadedAt:new Date().toISOString()} as CRMData;
}
