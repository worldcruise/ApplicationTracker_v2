// Development-only synthetic fixture; no API/Auth access and no existing file replacement.
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {join,resolve,sep} from "node:path";
import {randomUUID} from "node:crypto";
import {ATS_CLASSIC,renderAtsClassic} from "@candidate/resume-engine";
import {historyHash,identifyJob} from "@candidate/domain";
import type {ArchiveManifestV1,CandidateProfile,ReviewedJobContext} from "@candidate/contracts";
import {buildArchiveIndex} from "../src/archive";

const args=process.argv.slice(2),options:Record<string,string>={};
for(let i=0;i<args.length;i+=2){const key=args[i],value=args[i+1];if(!["--organization-id","--candidate-id"].includes(key??"")||!value||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value))throw Error("Use --organization-id <synthetic UUID> --candidate-id <synthetic UUID>.");options[key!]=value.toLowerCase();}
const organizationId=options["--organization-id"],candidateId=options["--candidate-id"];
if(!organizationId||!candidateId)throw Error("Both synthetic organization and candidate UUIDs are required. This command never changes the database.");
const scope={actorId:"fixture-only",organizationId,candidateId};
const context:ReviewedJobContext={company:"Synthetic History Labs",title:"Synthetic Engineer",url:"https://jobs.example.invalid/jobs/123",description:"Build synthetic archive tools.",externalId:"123"};
const ids=await identifyJob(context),runId=randomUUID(),root=fileURLToPath(new URL("../../../output/quick-check/",import.meta.url)),archiveRoot=resolve(root,runId);
if(!archiveRoot.startsWith(resolve(root)+sep))throw Error("Fixture path is outside the intended ignored output directory.");
await mkdir(root,{recursive:true});await mkdir(archiveRoot);
const candidateFolder="Synthetic Candidate__"+candidateId,companyFolder="Synthetic History Labs__"+(await historyHash(ids.companyKey)).slice(0,12);
const company=join(archiveRoot,candidateFolder,companyFolder);await mkdir(company,{recursive:true});
const snapshot:CandidateProfile={id:candidateId,organizationId,owningTeamId:randomUUID(),ownerId:null,fullName:"Synthetic Archive Candidate",email:"archive@example.invalid",phone:"+1 202 555 0199",location:"Synthetic City",seniorityPreference:null,professionalSummary:"Synthetic archive fixture only.",privateNotes:"",status:"draft",rowVersion:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),links:[],experiences:[],educations:[],certifications:[],assignments:[]};
const rawJson=JSON.stringify({company:context.company,title:context.title,summary:snapshot.professionalSummary,skills:[],experience:[],education:[]},null,2);
const fontsRoot=new URL("../../../packages/resume-engine/assets/fonts/",import.meta.url);
const rendered=await renderAtsClassic({regular:new Uint8Array(await readFile(new URL("NotoSans-Regular.ttf",fontsRoot))),bold:new Uint8Array(await readFile(new URL("NotoSans-Bold.ttf",fontsRoot)))},{rawJson,snapshot,mapping:{experienceIds:[],educationIds:[],claims:{}},reviewed:false,renderedAt:new Date().toISOString(),templateVersionId:ATS_CLASSIC.id});
const entries=[];
for(const url of [context.url,"https://jobs.example.invalid/jobs/456"]){
  const job={...context,url},identifiers=await identifyJob(job),operationId=randomUUID(),directory="Synthetic_Engineer__"+operationId,path=join(company,directory);await mkdir(path);
  const files:Record<string,Uint8Array>={"JobDetails.txt":new TextEncoder().encode(JSON.stringify(job,null,2)),"Resume.json":new TextEncoder().encode(rawJson),"Resume.pdf":rendered.bytes};
  const manifest:ArchiveManifestV1={archiveVersion:1,organizationId,candidateId,operationId,bidId:null,context:job,identifiers,packageComplete:true,schemaVersion:1,templateVersionId:ATS_CLASSIC.id,rendererVersion:rendered.rendererVersion,files:{}};
  for(const [name,bytes] of Object.entries(files)){await writeFile(join(path,name),bytes,{flag:"wx"});manifest.files[name]={sha256:await historyHash(bytes),bytes:bytes.length};}
  await writeFile(join(path,"metadata.json"),JSON.stringify(manifest,null,2)+"\n",{flag:"wx"});entries.push({directory,operationId,identifiers});
}
await writeFile(join(company,"archive-index.json"),JSON.stringify(buildArchiveIndex(scope,ids.companyKey,entries),null,2)+"\n",{flag:"wx"});
console.log(JSON.stringify({syntheticOnly:true,archiveRoot,companyFolder:company,context,packages:entries.length,message:"Choose this new root, link the company folder and check this context. No database history was created."},null,2));
