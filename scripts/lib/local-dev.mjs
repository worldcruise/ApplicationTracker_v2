import {createServer} from 'node:net';
import {developmentProject,publicKey} from './production-config.mjs';

export function localSettings(env){
 const expected=`https://${developmentProject}.supabase.co`;
 let url;try{url=new URL(env.NEXT_PUBLIC_SUPABASE_URL??'');}catch{throw Error('Set NEXT_PUBLIC_SUPABASE_URL in apps/web/.env.local; see docs/LOCAL_PILOT.md.');}
 if(url.origin!==expected||!['','/'].includes(url.pathname)||url.search||url.hash||url.username||url.password)throw Error('Stage 1 uses the existing development Supabase project xsyxlxpsglhkmvzlmhih. Keep production configuration separate.');
 const key=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
 if(!key||!publicKey(key))throw Error('Set a public Supabase publishable/anon key in apps/web/.env.local. Never use a user token or service/secret key as public configuration.');
 const requested=env.PORT?.trim();
 if(requested&&!/^\d+$/.test(requested))throw Error('PORT must be an integer from 1024 to 65535.');
 const port=requested?Number(requested):3000;
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('PORT must be an integer from 1024 to 65535.');
 return {port,explicitPort:!!requested};
}

export function portAvailable(port){
 return new Promise((ok,fail)=>{
  const server=createServer();
  server.once('error',error=>error.code==='EADDRINUSE'?ok(false):fail(Error(`Cannot check localhost port ${port} (${error.code??'SOCKET_ERROR'}). This is not proof the port is occupied.`)));
  server.listen(port,'127.0.0.1',()=>server.close(error=>error?fail(Error('Cannot release localhost port probe.')):ok(true)));
 });
}

export async function selectLocalOrigin({port=3000,explicitPort=false}={}){
 for(let candidate=port;candidate<=Math.min(port+(explicitPort?0:10),65535);candidate++){
  if(await portAvailable(candidate))return {port:candidate,origin:`http://localhost:${candidate}`};
 }
 throw Error(explicitPort?'Requested PORT is already in use. Stop its owner or choose another PORT.':'Localhost ports 3000–3010 are occupied. Set an available PORT explicitly.');
}
