import release from "../../../../../releases/pilot.json";
export const dynamic="force-dynamic";
export function GET(){return Response.json({status:"ok",release:release.release,apiContract:release.apiContract,livenessOnly:true},{headers:{"Cache-Control":"private, no-store"}});}
