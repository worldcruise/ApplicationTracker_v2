import { test } from "node:test";
import assert from "node:assert/strict";
import { workspaceNavigation } from "../src/components/navigation";
import type { OrganizationRole } from "@candidate/contracts";

test("workspace destinations retain organization context and hide unsupported role workflows", () => {
  for (const role of ["admin", "team_leader", "team_member", "bidder"] satisfies OrganizationRole[]) {
    const links = workspaceNavigation({ organizationId: "synthetic-org", name: "Synthetic Pilot", role, teams: [] });
    assert.equal(new Set(links.map(l => l.label)).size, links.length);
    for (const link of links) assert.equal(new URL(link.href, "http://localhost").searchParams.get("organizationId"), "synthetic-org");
    assert.equal(links.some(l => l.label === "Account approvals"), role === "admin");
    assert.equal(links.some(l => l.label === "Team & permissions"), ["admin", "team_leader"].includes(role));
    for (const label of ["Candidates", "Interviews", "Resume Studio", "Templates", "Prompts"]) assert.equal(links.some(l => l.label === label), role !== "bidder");
    for (const label of ["Bids", "Document history", "Follow-ups"]) assert(links.some(l => l.label === label));
  }
});
