import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applicationOrigin, callbackDestination } from "@/lib/api/guards";
import { preventSessionCaching } from "@/lib/supabase/response";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const code = query.get("code");
  const client = await createClient();
  const result = code ? await client.auth.exchangeCodeForSession(code) : null;
  const destination = result && !result.error ? callbackDestination(query.get("mode")) : "/sign-in?link=invalid";
  return preventSessionCaching(NextResponse.redirect(new URL(destination, applicationOrigin())));
}

