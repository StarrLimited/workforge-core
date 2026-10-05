import type { Role, Workspace } from '../core';
export type Company = {id:string;name:string;website:string;phone:string;industry:string;address:string};
export type Person = {id:string;name:string;email:string;phone:string;job_title:string;company_id:string|null;source:string;lifecycle:'lead'|'qualified'|'customer'|'archived';tags:string[];owner_id:string|null;do_not_contact:boolean;created_at:string};
export type Pipeline = {id:string;name:string};
export type Stage = {id:string;pipeline_id:string;name:string;position:number;probability:number;followup_days:number|null;purpose:string;checklist:string[];stale_days:number};
export type Deal = {id:string;pipeline_id:string;stage_id:string;contact_id:string;title:string;value_cents:number;status:'open'|'won'|'lost';lost_reason:string;owner_id:string|null;source:string;expected_close:string|null;closed_at:string|null;created_at:string;updated_at:string;stage_entered_at:string;priority:AcceptPriority;need:string;budget:string;decision_maker:string;buying_timeline:string;proposal_summary:string;proposal_url:string;proposal_status:ProposalStatus;proposal_sent_on:string|null;proposal_valid_until:string|null;completed_steps:string[]};
export type Activity = {id:string;contact_id:string|null;deal_id:string|null;owner_id:string|null;title:string;kind:'task'|'call'|'email'|'meeting';due_at:string;duration_minutes:number;completed_at:string|null;outcome:string;automatic:boolean;created_at:string};
export type Note = {id:string;contact_id:string|null;deal_id:string|null;body:string;author_id:string;created_at:string};
export type History = {id:string;entity:string;record_id:string;description:string;actor_id:string|null;created_at:string};
export type TeamMember = {user_id:string;email:string;role:Role;is_active:boolean};
export type CRMData = {workspace:Workspace;workspaces:Workspace[];role:Role;userId:string;companies:Company[];contacts:Person[];pipelines:Pipeline[];stages:Stage[];deals:Deal[];activities:Activity[];notes:Note[];history:History[];team:TeamMember[];loadedAt:string};

export type AcceptPriority='low'|'normal'|'high';
export type ProposalStatus='draft'|'shared'|'accepted'|'declined';
