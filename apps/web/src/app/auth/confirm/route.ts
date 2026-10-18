import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applicationOrigin } from "@/lib/api/guards";
import { preventSessionCaching } from "@/lib/supabase/response";

export const dynamic = "force-dynamic";
/** Fixed invite/recovery email template callback; never accept arbitrary redirect URLs. */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const hash = query.get("token_hash");
  const type = query.get("type");
  let valid = false;
  if (hash && (type === "invite" || type === "recovery")) {
    const { error } = await (await createClient()).auth.verifyOtp({ token_hash: hash, type });
    valid = !error;
  }
  return preventSessionCaching(NextResponse.redirect(new URL(valid ? "/account/update-password" : "/sign-in?link=invalid", applicationOrigin())));
}

