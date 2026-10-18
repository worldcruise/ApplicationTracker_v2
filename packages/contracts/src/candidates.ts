export type CandidateStatus = "draft" | "ready" | "archived";
export type TitlePolicy = "fixed" | "tailorable" | "omit";
export interface ProfessionalLink { id: string; type: "linkedin" | "github" | "website" | "portfolio" | "other"; url: string }
export interface WorkExperience {
  id: string; company: string | null; officialTitle: string | null; proposedDisplayTitle: string | null;
  titlePolicy: TitlePolicy; startDate: string | null; endDate: string | null; current: boolean;
  location: string | null; sourceBullets: string[]; achievements: string[]; preferredBulletCount: number | null;
}
export interface Education {
  id: string; institution: string | null; degree: string | null; fieldOfStudy: string | null;
  startDate: string | null; endDate: string | null; displayPolicy: TitlePolicy;
}
export interface Certification {
  id: string; name: string | null; issuer: string | null; issueDate: string | null; expiryDate: string | null;
  verificationStatus: "unverified" | "verified" | "expired"; credentialId: string | null;
}
/** Candidate profile content; separate from the unchanged canonical resume v1. */
export interface CandidateProfileInput {
  fullName: string | null; email: string | null; phone: string | null; location: string | null;
  seniorityPreference: string | null; professionalSummary: string | null; privateNotes: string | null;
  status: "draft" | "ready";
  links: ProfessionalLink[]; experiences: WorkExperience[]; educations: Education[]; certifications: Certification[];
}
export interface CandidateProfile extends Omit<CandidateProfileInput, "status" | "experiences"> {
  id: string; organizationId: string; owningTeamId: string; ownerId: string | null;
  status: CandidateStatus; rowVersion: number; createdAt: string; updatedAt: string;
  experiences: (WorkExperience & { approvedDisplayTitle: string | null; titleApprovedBy: string | null; titleApprovedAt: string | null })[];
  assignments: { id: string; userId: string; teamId: string; activeFrom: string; endedAt: string | null }[];
}
export interface CandidateDirectory {
  items: { id: string; fullName: string | null; email: string | null; location: string | null;
    status: CandidateStatus; owningTeamId: string; ownerId: string | null; rowVersion: number; updatedAt: string }[];
  total: number; page: number; pageSize: number;
}
export interface CandidateValidationIssue { path: string; message: string }
