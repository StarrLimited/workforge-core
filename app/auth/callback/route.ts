import { NextRequest,NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET(request:NextRequest){const code=request.nextUrl.searchParams.get('code');const tokenHash=request.nextUrl.searchParams.get('token_hash');const db=await createClient();
  const origin=process.env.NEXT_PUBLIC_APP_URL??request.nextUrl.origin;
  if(code){const {error}=await db.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL('/',origin));}
  if(tokenHash){const {error}=await db.auth.verifyOtp({token_hash:tokenHash,type:'email'});if(!error)return NextResponse.redirect(new URL('/',origin));}
  return NextResponse.redirect(new URL('/login?error=callback',origin));
}
