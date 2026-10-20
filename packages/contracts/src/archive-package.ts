import type {FrozenTemplate} from "./templates.js";
import type {HistoryIdentifiers,ReviewedJobContext} from "./history.js";
export type PackageReference={kind:"operation";operationId:string}|{kind:"document";documentId:string};
export interface FrozenPackageInput {
  version:1; operationId:string; actorId:string; organizationId:string; candidateId:string; deviceId:string; createdAt:string;
  candidateName:string; context:ReviewedJobContext; identifiers:HistoryIdentifiers; relativePath:string[];
  capturedAt?:string|null;
  resume:{reference:PackageReference;rawJson:string;pdfSha256:string;pageCount:number;schemaVersion:1;profileRevision:number;template:FrozenTemplate;rendererVersion:string;renderedAt:string};
  coverLetter:{reference:PackageReference;text:string}|null;
  existingBidId:string|null;
}
export interface PackageSyncResult {
  operationId:string;bidId:string;reusedBid:boolean;resumeDocumentId:string;resumeVersionId:string;
  coverLetterVersionId:string|null;createdAt:string;
}
export type PackageStep="local"|"database"|"reconciliation"|"clipboard";
export interface PackageOutcome {state:"idle"|"pending"|"succeeded"|"failed"|"unknown"|"conflict";attempts:number;updatedAt:string|null;error:string|null}
export type PackageOutcomes=Record<PackageStep,PackageOutcome>;
