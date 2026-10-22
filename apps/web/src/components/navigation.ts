import type { OrganizationScope } from "@candidate/contracts";

export type NavigationItem = { label: string; href: string; icon: string; group: "Daily work" | "Production" | "Administration" };
export function navigationIsActive(item: NavigationItem, path: string, params: { get: (key: string) => string | null }, hash: string): boolean {
  const url = new URL(item.href, "http://localhost");
  const studio = /^\/candidates\/[^/]+\/(studio|letters)\/?$/u.test(path);
  if (studio && ["Resume Studio", "Templates", "Prompts"].includes(item.label)) return item.label === (hash === "#templates" ? "Templates" : hash === "#prompts" ? "Prompts" : "Resume Studio");
  if (/^\/candidates\/[^/]+\/?$/u.test(path)) return item.label === "Candidates";
  if (/^\/bids(\/[^/]+)?\/?$/u.test(path)) return item.label === (params.get("view") === "interviews" ? "Interviews" : params.get("view") === "followups" ? "Follow-ups" : "Bids");
  return url.pathname === path && (url.hash ? hash === url.hash : !hash) && (url.searchParams.get("intent") ?? "") === (params.get("intent") ?? "");
}
/** Presentation only. Every destination independently resolves current backend permissions. */
export function workspaceNavigation(scope: OrganizationScope): NavigationItem[] {
  const q = `organizationId=${encodeURIComponent(scope.organizationId)}`;
  const items: NavigationItem[] = [
    { label: "Dashboard", href: `/dashboard?${q}`, icon: "dashboard", group: "Daily work" },
    ...(scope.role === "bidder" ? [] : [{ label: "Candidates", href: `/candidates?${q}`, icon: "people", group: "Daily work" as const }]),
    { label: "Bids", href: `/bids?${q}`, icon: "briefcase", group: "Daily work" },
    ...(scope.role === "bidder" ? [] : [{ label: "Interviews", href: `/interviews?${q}`, icon: "calendar", group: "Daily work" as const }]),
    { label: "Follow-ups", href: `/tasks?${q}`, icon: "check", group: "Daily work" },
    { label: "Notifications", href: `/dashboard?${q}#notifications`, icon: "bell", group: "Daily work" },
    ...(scope.role === "bidder" ? [] : [
      { label: "Resume Studio", href: `/candidates?${q}&intent=studio`, icon: "document", group: "Production" as const },
      { label: "Templates", href: `/candidates?${q}&intent=templates`, icon: "layout", group: "Production" as const },
      { label: "Prompts", href: `/candidates?${q}&intent=prompts`, icon: "message", group: "Production" as const },
    ]),
    { label: "Document history", href: `/documents?${q}`, icon: "history", group: "Production" },
    ...(["admin", "team_leader"].includes(scope.role) ? [{ label: "Team & permissions", href: `/workspace?${q}#administration`, icon: "people", group: "Administration" as const }] : []),
    ...(scope.role === "admin" ? [{ label: "Account approvals", href: `/admin/account-requests?${q}`, icon: "shield", group: "Administration" as const }] : []),
    { label: "Workspace settings", href: `/workspace?${q}#current-access`, icon: "settings", group: "Administration" },
  ];
  return items;
}
