import { NextRequest,NextResponse } from 'next/server';
import { session } from '@/lib/data';
export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;const {db}=await session();
  const {data:file,error}=await db.from('file_records').select('object_path,name').eq('id',id).maybeSingle();
  if(error||!file)return new Response('File not found.',{status:404});
  const {data,error:signedError}=await db.storage.from('workforge-files').createSignedUrl(file.object_path,60,{download:file.name});
  if(signedError||!data)return new Response('Unable to open file.',{status:503});
  const response=NextResponse.redirect(data.signedUrl);response.headers.set('Cache-Control','private, no-store');return response;
}
