import {redirect} from 'next/navigation';
import {BillingError} from '@/lib/square/core';
import SquareBilling from '@/components/square-billing';
import {billingContext} from '@/lib/square/context';
import './billing.css';
export const dynamic='force-dynamic';
export default async function Page(){try{await billingContext(false);}catch(e){if(e instanceof BillingError&&e.status===401)redirect('/login');throw e;}return <SquareBilling brand="WorkForge HQ" back="/hq" accountingNote="Square collections are shown here. Commercial fee and subscription records remain separate; reconcile payments before changing their manually recorded totals." />;}
