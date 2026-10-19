import { workflow, preflight } from '@/lib/workflow/service';
export const dynamic='force-dynamic';export const OPTIONS=preflight;
type Route={params:Promise<{parts?:string[]}>};
async function handle(request:Request,{params}:Route){return workflow(request,'bids',(await params).parts??[]);}
export {handle as GET,handle as POST,handle as PATCH};
