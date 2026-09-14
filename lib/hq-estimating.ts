import { z } from 'zod';
import { CATEGORIES, CADENCES, DOC_FIELDS, DISCOVERY, lineAmount, type Proposal, type Opportunity, type Requirement } from './hq-sales';

export const DISCOVERY_STARTERS: Record<string,string> = {
 outcomes:'What takes too much time or causes problems today?\n[Add answer]\n\nWhat would a better result look like? How will we know it worked?\n[Add answer]',
 people:'Who makes the buying decision and signs the agreement?\n[Add answer]\n\nWho will use the system, help us test it, and approve the launch?\n[Add answer]',
 workflow:'Walk us through one real job or customer request, from first contact to payment and follow-up.\n[Add answer]\n\nWhat happens when something changes, gets cancelled, or goes wrong?\n[Add answer]',
 roles:'What should each person be allowed to see, change, approve, or send?\n[Add answer]\n\nWill they use a computer, phone, or tablet? Do they need to work without internet?\n[Add answer]',
 systems:'Which apps do you use now? Which should stay and which should be replaced?\n[Add answer]\n\nWhat information needs to move between them, in which direction, and who will check it?\n[Add answer]',
 migration:'What existing customers, jobs, prices, documents, or history do we need to bring over?\n[Add answer]\n\nCan we get a sample export? Who will help check that the information is complete and correct?\n[Add answer]',
 rules:'How do you calculate prices, costs, discounts, taxes, and deposits? Who approves exceptions?\n[Add answer]\n\nWhich estimates, contracts, invoices, and reports do you need? Who sends them?\n[Add answer]',
 automation:'What repetitive work would you like the system to do for you?\n[Add answer]\n\nWhat still needs a person to approve it? What should happen if it fails or reaches a spending limit?\n[Add answer]',
 security:'What information needs extra protection, and who should have access?\n[Add answer]\n\nHow much downtime or lost work could you tolerate? How long should records be kept?\n[Add answer]',
 commercial:'What budget have you set for the initial build and the monthly service?\n[Add answer]\n\nWhen do you need it, what help can your team provide, and what support will you need after launch?\n[Add answer]',
};
export const pricebookSchema = z.object({name:z.string().trim().min(1).max(200),description:z.string().trim().min(1).max(4000),service:z.enum(CATEGORIES),cadence:z.enum(CADENCES),unit_cents:z.number().int().min(1).max(100000000).nullable(),unit_label:z.string().trim().min(1).max(80),active:z.boolean()});
export type HQPricebookItem=z.infer<typeof pricebookSchema>&{id:string;updated_at:string;sku:string};
export type AgreementSignature={id:string;proposal_id:string;party:'provider'|'client';name:string;title:string;email:string;signature_image:string;consent:string;signed_at:string;document_hash:string};
export type SigningRequest={id:string;proposal_id:string;recipient_email:string;expires_at:string;revoked_at:string|null;created_at:string};
export type MailDelivery={id:string;proposal_id:string;recipient_email:string;status:'sending'|'sent'|'failed'|'unknown';sent_at:string|null;created_at:string;error:string};
export const SIGNING_CONSENT='I have read this agreement and approve its scope, prices, payment schedule, and terms. I am authorized to sign for the party named above. I agree to use my typed name and, if supplied, drawn signature as my electronic signature for this exact revision.';
export const signatureSchema=z.object({name:z.string().trim().min(2).max(200),title:z.string().trim().min(1).max(200),email:z.email().max(254),signature_image:z.string().max(200000).refine(v=>v===''||/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v),'Use the signature area to draw your signature.'),consent:z.literal(true)});
export function proposalReadiness(p:Proposal,o:Opportunity,requirements:Requirement[],day:string):string[]{
 const missing:string[]=[];
 if(p.valid_until<day)missing.push('Choose a future expiry date.');
 for(const [key,label] of DOC_FIELDS)if(!p.document[key]?.trim()||p.document[key].includes('[Complete'))missing.push('Complete '+label.toLowerCase()+'.');
 if(!p.terms_reviewed)missing.push('Review and confirm the agreement terms.');
 if(p.lines.some(l=>!l.description.trim()||l.unit_cents<=0||lineAmount(l)<=0))missing.push('Set a price and description for every service.');
 if(!p.lines.some(l=>l.cadence!=='usage'))missing.push('Include at least one fixed fee.');
 if(!requirements.some(r=>r.priority==='must'))missing.push('Add a must-have deliverable and its expected result.');
 if(o.kind!=='blueprint'){
  for(const [key,label] of DISCOVERY){const a=o.discovery.answers?.[key];if(!a||!['confirmed','not_applicable'].includes(a.status)||!a.notes.trim()||a.notes.includes('[Add answer]'))missing.push('Finish discovery: '+label+'.');}
  if(o.discovery.open_questions.trim())missing.push('Resolve the open discovery questions or create a Blueprint engagement.');
 }
 return missing;
}
