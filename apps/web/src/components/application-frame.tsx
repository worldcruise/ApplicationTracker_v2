"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { UserContext } from "@candidate/contracts";
import { Brand, Button, StatusBadge } from "@candidate/ui";
import { SignOut } from "@/app/workspace/sign-out";
import { Icon } from "./icon";
import { navigationIsActive, workspaceNavigation } from "./navigation";

export function ApplicationFrame({ title, description, context, name, children }: { title: string; description: string; context: UserContext; name: string; children: ReactNode }) {
  const path = usePathname(); const query = useSearchParams();
  const [collapsed, setCollapsed] = useState(false); const [hash, setHash] = useState("");
  const drawer = useRef<HTMLDialogElement>(null);
  const scope = context.organizations.find(o => o.organizationId === query.get("organizationId")) ?? context.organizations[0]!;
  const items = workspaceNavigation(scope);
  useEffect(() => { try { setCollapsed(localStorage.getItem("at-sidebar-collapsed") === "true"); } catch { /* Optional presentation preference. */ } }, []);
  useEffect(() => { const change = () => setHash(window.location.hash); change(); window.addEventListener("hashchange", change); return () => window.removeEventListener("hashchange", change); }, [path, query]);
  function links() {
    return <nav aria-label="Main navigation">{(["Daily work", "Production", "Administration"] as const).map(group => <div className="nav-group" key={group}><p>{group}</p>{items.filter(i => i.group === group).map(item => {
      const url = new URL(item.href, "http://localhost");
      const active = navigationIsActive(item, path, query, hash);
      return <a key={item.label} href={item.href} title={collapsed ? item.label : undefined} aria-label={item.label} aria-current={active ? "page" : undefined} className="sidebar-link" onClick={() => { drawer.current?.close(); setHash(url.hash); }}><Icon name={item.icon} /><span className="nav-label">{item.label}</span></a>;
    })}</div>)}</nav>;
  }
  const brand = <a href={`/dashboard?organizationId=${scope.organizationId}`} className="sidebar-brand" aria-label="Application Tracker v2 home"><Brand /></a>;
  return <div className={`workspace-shell app-frame ${collapsed ? "sidebar-collapsed" : ""}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="app-sidebar" aria-label="Workspace sidebar">{brand}<div className="sidebar-context"><span className="organization-avatar">{scope.name.slice(0, 1).toUpperCase()}</span><div className="nav-label"><strong>{scope.name}</strong><span>{scope.role.replaceAll("_", " ")}</span></div></div>{links()}<div className="sidebar-bottom"><span className="local-indicator" /><span className="nav-label">Local pilot · hosted database</span></div></aside>
    <dialog ref={drawer} className="navigation-drawer" aria-label="Navigation"><div className="drawer-heading">{brand}<Button variant="ghost" aria-label="Close navigation" onClick={() => drawer.current?.close()}><Icon name="close" /></Button></div>{links()}</dialog>
    <div className="app-body"><header className="app-topbar"><div className="topbar-start"><Button variant="ghost" className="desktop-collapse" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} onClick={() => { setCollapsed(!collapsed); try { localStorage.setItem("at-sidebar-collapsed", String(!collapsed)); } catch { /* Optional preference. */ } }}><Icon name="layout" /></Button><Button variant="ghost" className="mobile-menu" aria-label="Open navigation" aria-haspopup="dialog" onClick={() => drawer.current?.showModal()}><Icon name="menu" /></Button><span className="topbar-breadcrumb">Workspace <span>/</span> <strong>{title}</strong></span></div>
      <div className="topbar-actions"><span className="workspace-badge topbar-pilot">Local pilot</span><Link className="notification-link" href={`/dashboard?organizationId=${scope.organizationId}#notifications`} aria-label="Open notifications"><Icon name="bell" /></Link><details className="account-menu"><summary aria-label="Account menu"><span className="user-avatar">{name.slice(0, 1).toUpperCase()}</span><span className="user-name">{name}</span><span aria-hidden="true">⌄</span></summary><div className="account-popover"><strong>{name}</strong><StatusBadge value={scope.role} /><Link href={`/workspace?organizationId=${scope.organizationId}#current-access`}>Current access & settings</Link></div></details><SignOut /></div>
    </header><main id="main-content" className="workspace-main"><div className="page-heading"><span className="eyebrow">{scope.name}</span><h1>{title}</h1><p className="workspace-description">{description}</p></div>{children}</main></div>
  </div>;
}
