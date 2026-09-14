const HQ='8ac08858-038c-41df-90a8-4a84f25cb400';
const APP='https://workforge-development.vercel.app';
const SENDER='estimating@workforgeos.com';
const SCOPES=['openid','email','https://www.googleapis.com/auth/gmail.send','https://www.googleapis.com/auth/gmail.settings.basic'];
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const digest=async s=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))));
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const base64=s=>btoa(Array.from(new TextEncoder().encode(s),b=>String.fromCharCode(b)).join(''));
const url64=s=>base64(s).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const emailOK=s=>typeof s==='string'&&s.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);
export function estimateEmail({recipient,subject,message,link,number,revision}) {
 if(!emailOK(recipient)||/[\r\n]/.test(subject)||subject.length>200||!link.startsWith(APP+'/agreements/review#'))throw new Error('Check the recipient and email subject.');
 const body=`${message}\n\nReview and sign agreement ${number}, revision ${revision}:\n${link}\n\nThis private link is intended for the named signer. You can print or save the agreement before and after signing.\n\nWorkForge\n${SENDER}`;
 return url64([`From: WorkForge Estimating <${SENDER}>`,`To: ${recipient}`,`Reply-To: ${SENDER}`,`Subject: =?UTF-8?B?${base64(subject)}?=`,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',base64(body)].join('\r\n'));
}
export function createHandler({supabaseUrl,serviceKey,fetchImpl=fetch}) {
 const callback=supabaseUrl+'/functions/v1/hq-gmail/callback';
 async function rpc(name,data,token=serviceKey){const r=await fetchImpl(supabaseUrl+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(data)});const body=await r.json();if(!r.ok)throw new Error(body.message||'Unable to update the Gmail connection.');return body;}
 const backend=(action,data={})=>rpc('hq_gmail_backend',{p_action:action,p_data:data});
 async function member(token){const response=await fetchImpl(supabaseUrl+'/auth/v1/user',{headers:{apikey:serviceKey,Authorization:'Bearer '+token}});if(!response.ok)throw new Error('Sign in to WorkForge HQ.');const user=await response.json();
  const r=await fetchImpl(supabaseUrl+'/rest/v1/workspace_memberships?select=role&workspace_id=eq.'+HQ+'&user_id=eq.'+user.id+'&is_active=eq.true',{headers:{apikey:serviceKey,Authorization:'Bearer '+token}});const rows=await r.json();if(!r.ok||!rows[0])throw new Error('WorkForge HQ access required.');return {id:user.id,role:rows[0].role};}
 async function stillOwner(userId){const r=await fetchImpl(supabaseUrl+'/rest/v1/workspace_memberships?select=role&workspace_id=eq.'+HQ+'&user_id=eq.'+userId+'&is_active=eq.true',{headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey}});const rows=await r.json();return r.ok&&['owner','administrator'].includes(rows[0]?.role);}
 async function tokenRequest(data){const r=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data),signal:AbortSignal.timeout(15000)});const t=await r.json();if(!r.ok||!t.access_token)throw new Error('Google authorization expired or was denied. Reconnect Gmail.');return t;}
 async function verifyAlias(token){const r=await fetchImpl('https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});const aliases=await r.json();if(!r.ok||!aliases.sendAs?.some(a=>a.sendAsEmail?.toLowerCase()===SENDER&&a.verificationStatus==='accepted'))throw new Error('Add and verify estimating@workforgeos.com as a Gmail Send mail as address, then reconnect.');}
 return async function handler(request){
  const url=new URL(request.url);
  if(request.method==='GET'&&url.pathname.endsWith('/callback')){
   try{
    const state=await backend('consume',{state_hash:await digest(url.searchParams.get('state')||'')});
    if(!state||!await stillOwner(state.user_id))throw new Error('Authorization request expired.');
    const config=await backend('get');if(config.client_id!==state.client_id||url.searchParams.has('error'))throw new Error('Authorization was not completed.');
    const tokens=await tokenRequest({code:url.searchParams.get('code')||'',client_id:config.client_id,client_secret:config.client_secret,redirect_uri:callback,grant_type:'authorization_code',code_verifier:state.verifier});
    if(!tokens.refresh_token)throw new Error('Google did not grant continuing access.');
    await verifyAlias(tokens.access_token);
    await backend('put',{client_id:config.client_id,client_secret:config.client_secret,refresh_token:tokens.refresh_token,connected_at:new Date().toISOString(),sender:SENDER});
    return Response.redirect(APP+'/hq/sales?mail=connected',303);
   }catch{return Response.redirect(APP+'/hq/sales?mail=authorization_failed',303);}
  }
  if(request.method!=='POST')return json({error:'Method not allowed.'},405);
  if(Number(request.headers.get('content-length')||0)>20000)return json({error:'Request too large.'},413);
  try{
   const token=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
   const user=await member(token);const raw=await request.text();if(raw.length>20000)return json({error:'Request too large.'},413);const body=JSON.parse(raw);
   const config=await backend('get');const admin=['owner','administrator'].includes(user.role);
   if(body.action==='status')return json({configured:!!config.client_id,connected:!!config.refresh_token,sender:SENDER,connected_at:config.connected_at||null,callback,admin});
   if(['configure','connect','disconnect'].includes(body.action)&&!admin)return json({error:'An HQ owner or administrator must manage Gmail.'},403);
   if(body.action==='configure'){
    if(typeof body.client_id!=='string'||!body.client_id.endsWith('.apps.googleusercontent.com')||body.client_id.length>300||typeof body.client_secret!=='string'||body.client_secret.length<10||body.client_secret.length>500)throw new Error('Enter the Google web application client ID and secret.');
    await backend('put',{client_id:body.client_id.trim(),client_secret:body.client_secret.trim()});return json({ok:true});
   }
   if(body.action==='connect'){
    if(!config.client_id)throw new Error('Save your Google OAuth client configuration first.');
    const state=random(),verifier=random();const challenge=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
    await backend('state',{state_hash:await digest(state),user_id:user.id,verifier,client_id:config.client_id});
    const params=new URLSearchParams({client_id:config.client_id,redirect_uri:callback,response_type:'code',scope:SCOPES.join(' '),access_type:'offline',prompt:'consent select_account',state,code_challenge:challenge,code_challenge_method:'S256'});
    return json({url:'https://accounts.google.com/o/oauth2/v2/auth?'+params});
   }
   if(body.action==='disconnect'){
    if(config.refresh_token){const r=await fetchImpl('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:config.refresh_token}),signal:AbortSignal.timeout(15000)});if(!r.ok&&r.status!==400)throw new Error('Google could not revoke the connection. Try again.');}
    await backend('put',{client_id:config.client_id,client_secret:config.client_secret});return json({ok:true});
   }
   if(body.action==='send'){
    if(!['owner','administrator','member'].includes(user.role))return json({error:'HQ write access required.'},403);
    if(!config.refresh_token)throw new Error('Connect Gmail before sending an estimate.');
    if(!emailOK(body.recipient)||typeof body.proposal_id!=='string'||!/^[0-9a-f-]{36}$/.test(body.proposal_id)||typeof body.message!=='string'||!body.message.trim()||body.message.length>6000||typeof body.subject!=='string'||!body.subject.trim()||body.subject.length>200||/[\r\n]/.test(body.subject)||body.confirmed!==true)throw new Error('Review the recipient, subject and message before sending.');
    const pr=await fetchImpl(supabaseUrl+'/rest/v1/hq_proposals?select=id,number,revision,status&id=eq.'+body.proposal_id,{headers:{apikey:serviceKey,Authorization:'Bearer '+token}});const proposals=await pr.json();const p=proposals[0];if(!pr.ok||!p||p.status!=='issued')throw new Error('Open an issued estimate before sending.');
    const tokens=await tokenRequest({client_id:config.client_id,client_secret:config.client_secret,refresh_token:config.refresh_token,grant_type:'refresh_token'});await verifyAlias(tokens.access_token);
    const link=await rpc('hq_create_signing_request',{p_id:p.id,p_email:body.recipient},token);
    const rawEmail=estimateEmail({recipient:body.recipient,subject:body.subject,message:body.message,link:APP+'/agreements/review#'+link.token,number:p.number,revision:p.revision});
    const delivery=await backend('begin_send',{proposal_id:p.id,request_id:link.id});let result;
    try{
     const sent=await fetchImpl('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+tokens.access_token,'Content-Type':'application/json'},body:JSON.stringify({raw:rawEmail}),signal:AbortSignal.timeout(20000)});
     if(!sent.ok){await backend('finish_send',{id:delivery.id,status:sent.status>=500?'unknown':'failed',error:sent.status>=500?'Google returned an uncertain result. Check Gmail Sent before retrying.':'Google rejected this email. Check the sender setup and reconnect Gmail.'});throw new Error(sent.status>=500?'Delivery is uncertain. Check Gmail Sent before retrying.':'Google rejected this email. Check the sender setup and reconnect Gmail.');}
     result=await sent.json();if(!result.id)throw new Error('Delivery is uncertain. Check Gmail Sent before retrying.');
    }catch(error){if(!result){try{await backend('finish_send',{id:delivery.id,status:'unknown',error:'Delivery could not be confirmed. Check Gmail Sent before retrying.'});}catch{ /* Preserve a completed failed/unknown state. */ }}throw new Error(error.message?.startsWith('Google rejected')?error.message:'Delivery could not be confirmed. Check Gmail Sent before retrying.');}
    try{await backend('finish_send',{id:delivery.id,status:'sent',gmail_id:result.id});}catch{throw new Error('Gmail accepted the email, but HQ could not save the delivery status. Check Gmail Sent before retrying.');}
    return json({ok:true,message:'Estimate sent from '+SENDER+'.'});
   }
   return json({error:'Unknown Gmail action.'},400);
  }catch(error){return json({error:error.message||'Unable to complete the Gmail request.'},400);}
 };
}
