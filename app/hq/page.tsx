import type { Metadata } from 'next';
import { loadWorkspaces } from '@/lib/data';
import { loadHQ } from '@/lib/hq-data';
import { HQ_WORKSPACE_ID } from '@/lib/hq';
import HQWorkbench from '@/components/hq/workbench';
import BrandLogo from '@/components/brand-logo';
import './hq.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'WorkForge HQ | Internal operations', robots: { index: false, follow: false } };

export default async function HQPage() {
  const workspaces = await loadWorkspaces();
  if (!workspaces.some(w => w.id === HQ_WORKSPACE_ID)) return <main className="login-card"><BrandLogo plate/><h1>WorkForge HQ</h1><p>This workspace is available to the WorkForge team. Your account does not currently have access.</p><a href="/">Return to your workspaces</a></main>;
  const productWorkspace = workspaces.find(w => w.id !== HQ_WORKSPACE_ID);
  return <HQWorkbench data={await loadHQ()} productWorkspaceId={productWorkspace?.id} />;
}
