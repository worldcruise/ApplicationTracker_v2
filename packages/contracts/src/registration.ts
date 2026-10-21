export interface AccountStatus {
  status: "not_requested" | "pending" | "approved" | "rejected";
  registeredAt?: string;
  reviewedAt?: string | null;
  reason?: string | null;
  emailVerified?: boolean;
}
export interface AccountRequest {
  user_id: string; organization_id: string; full_name: string; email: string;
  registered_at: string; email_verified: boolean;
  status: "pending" | "approved" | "rejected";
  assigned_role: string | null; team_id: string | null;
  reviewed_by: string | null; reviewed_at: string | null; reason: string | null; row_version: number;
}
export function registrationErrors(input: { fullName: string; email: string; password: string; confirmation: string }) {
  const errors: { path: string; message: string }[] = [];
  if (!input.fullName.trim() || input.fullName.trim().length > 200) errors.push({ path: "fullName", message: "Enter your full name (1–200 characters)." });
  if (input.email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.push({ path: "email", message: "Enter a valid email address you can verify." });
  if (input.password.length < 12 || input.password.length > 256) errors.push({ path: "password", message: "Use a password between 12 and 256 characters." });
  if (input.password !== input.confirmation) errors.push({ path: "confirmation", message: "Passwords do not match. Re-enter the confirmation." });
  return errors;
}
