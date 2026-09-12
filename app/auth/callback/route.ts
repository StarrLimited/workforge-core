import { NextRequest,NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authRedirectUrl } from '@/lib/auth-redirect';
export async function GET(request:NextRequest){const code=request.nextUrl.searchParams.get('code');const tokenHash=request.nextUrl.searchParams.get('token_hash');const db=await createClient();
  if(code){const {error}=await db.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(authRedirectUrl(request.url,true));}
  if(tokenHash){const {error}=await db.auth.verifyOtp({token_hash:tokenHash,type:'email'});if(!error)return NextResponse.redirect(authRedirectUrl(request.url,true));}
  return NextResponse.redirect(authRedirectUrl(request.url,false));
}
