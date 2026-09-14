import type {Metadata} from 'next';
import {loadHQ} from '@/lib/hq-data';
import {loadSales} from '@/lib/hq-sales-data';
import SalesWorkbench from '@/components/hq/sales-workbench';
import '../hq.css';
import './sales.css';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Sales & delivery | WorkForge HQ',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{account?:string}>}){
 const [data,sales,params]=await Promise.all([loadHQ(),loadSales(),searchParams]);
 return <SalesWorkbench data={data} sales={sales} initialAccount={params.account}/>;
}
