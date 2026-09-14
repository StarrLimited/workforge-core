import BrandLogo from '@/components/brand-logo';
import { loadWorkspaces, loadWorkspace } from '@/lib/data';
import Workbench from '@/components/workbench';
import { redirect } from 'next/navigation';
import { HQ_WORKSPACE_ID } from '@/lib/hq';
export const dynamic='force-dynamic';
export default async function Home({searchParams}:{searchParams:Promise<{workspace?:string}>}) {
  const params=await searchParams; const workspaces=await loadWorkspaces();
  if(!workspaces.length)return <main className="login-card"><BrandLogo plate/><h1>Your account is ready.</h1><p>You need a workspace invitation before you can view business records. Contact your WorkForge administrator.</p><a href="/login">Return to sign in</a></main>;
  // Staff enter the internal business workspace; explicit product selections still work.
  const selected=workspaces.find(w=>w.id===params.workspace)??workspaces.find(w=>w.id===HQ_WORKSPACE_ID)??workspaces[0];
  if(selected.id===HQ_WORKSPACE_ID) redirect('/hq');
  const data=await loadWorkspace(selected.id);
  return <Workbench data={data} workspaces={workspaces}/>;
}
