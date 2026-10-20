import {productionConfig} from './lib/production-config.mjs';
import {pilotSmoke} from './lib/pilot-smoke.mjs';
try{
 const config=productionConfig(process.env);
 for(const key of ['PILOT_SMOKE_EMAIL','PILOT_SMOKE_PASSWORD','PILOT_SMOKE_ORGANIZATION_ID','PILOT_SMOKE_TEAM_ID'])if(!process.env[key])throw Error('Missing '+key+'. Use a designated synthetic test account.');
 if(process.env.PILOT_SMOKE_SYNTHETIC_CONFIRMED!=='true')throw Error('Confirm the account/team are designated for synthetic pilot testing.');
 const result=await pilotSmoke({supabaseUrl:config.supabaseUrl,publishableKey:config.publishableKey,appOrigin:config.apiOrigin,email:process.env.PILOT_SMOKE_EMAIL,password:process.env.PILOT_SMOKE_PASSWORD,organizationId:process.env.PILOT_SMOKE_ORGANIZATION_ID,teamId:process.env.PILOT_SMOKE_TEAM_ID});console.log(JSON.stringify(result));
}catch(e){console.error(e instanceof TypeError?'NETWORK_OR_RESPONSE_ERROR: verify DNS/TLS, service health and configured origins.':e.message);process.exitCode=1;}
