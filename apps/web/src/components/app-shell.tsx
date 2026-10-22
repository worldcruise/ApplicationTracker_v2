import "server-only";
import { cache, type ReactNode } from "react";
import { WorkspaceShell } from "@candidate/ui";
import { requestContext } from "@/lib/api/context";
import { ApplicationFrame } from "./application-frame";

const shellIdentity = cache(async () => {
  try {
    const { context, client } = await requestContext();
    if (!context.organizations.length) return null;
    const { data } = await client.from("users").select("display_name").eq("id", context.userId).maybeSingle();
    return { context, name: typeof data?.display_name === "string" ? data.display_name : "Your account" };
  } catch { return null; }
});

export async function AppShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const identity = await shellIdentity();
  if (!identity) return <WorkspaceShell title={title} description={description}>{children}</WorkspaceShell>;
  return <ApplicationFrame title={title} description={description} {...identity}>{children}</ApplicationFrame>;
}
