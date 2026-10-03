import type { Metadata } from 'next';
import { loadWorkspaces } from '@/lib/data';
import { loadCRM } from '@/lib/crm/data';
import CRMWorkbench from '@/components/crm/workbench';
import BrandLogo from '@/components/brand-logo';
import './crm.css';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'WorkForge CRM | Your sales process. Your CRM.',robots:{index:false,follow:false}};
export default async function CRMPage({searchParams}:{searchParams:Promise<{workspace?:string}>}) {
 const [params,all]=await Promise.all([searchParams,loadWorkspaces()]);
 const workspaces=all.filter(w=>w.model==='crm');
 const workspace=params.workspace?workspaces.find(w=>w.id===params.workspace):workspaces[0];
 if(!workspace)return <main className="login-card"><BrandLogo plate/><h1>WorkForge CRM</h1><p>Your account does not have access to this CRM workspace. Ask the workspace owner to add you.</p><a href="/">Your workspaces</a></main>;
 return <CRMWorkbench data={await loadCRM(workspace,workspaces)}/>;
}
