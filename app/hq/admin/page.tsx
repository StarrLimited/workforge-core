import { membership } from '@/lib/data';
import { HQ_WORKSPACE_ID } from '@/lib/hq';
import TeamAdmin from '@/components/hq/team-admin';
import '../hq.css';
export const dynamic='force-dynamic';
export const metadata={title:'WorkForge HQ | User administration',robots:{index:false,follow:false}};
export default async function AdminPage(){
  const {db,role,user}=await membership(HQ_WORKSPACE_ID);
  if(!['owner','administrator'].includes(role))return <main className="login-card"><h1>Administrator access required</h1><a href="/hq">Return to HQ</a></main>;
  const {data,error}=await db.rpc('hq_team');
  if(error)throw new Error('Unable to load your team. Please retry.');
  return <TeamAdmin team={data} role={role} currentUserId={user.id}/>;
}
