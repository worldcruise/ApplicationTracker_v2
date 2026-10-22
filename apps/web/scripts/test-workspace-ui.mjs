// Invoked only by the isolated CI harness. Screenshots contain synthetic UI only;
// no cookies, storage state, credentials, network traces or source payloads are saved.
import { chromium, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

export async function testWorkspaceUI({ org, identities, password, adminPassword }) {
  const browser = await chromium.launch(); let step = "sign in"; let checks = 0;
  const contexts = [];
  const directory = ".tools/ui-review"; mkdirSync(directory, { recursive: true });
  const noOverflow = async page => { expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); checks++; };
  async function login(person) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } }); contexts.push(context);
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    await page.goto("http://localhost:3000/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(person.email);
    await page.getByLabel("Password", { exact: true }).fill(person === identities.adminA ? adminPassword : password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/workspace"); return page;
  }
  try {
    const page = await login(identities.adminA);
    step = "desktop dashboard and collapse preference";
    await page.goto(`http://localhost:3000/dashboard?organizationId=${org}`);
    await expect(page.getByTestId("count-active_bids")).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Main navigation", exact: true });
    await expect(nav.getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute("aria-current", "page");
    const actionY = (await page.getByRole("region", { name: "Priority action queues" }).boundingBox()).y;
    expect(actionY).toBeLessThan((await page.getByRole("region", { name: "Dashboard metrics", exact: true }).boundingBox()).y); checks++;
    await noOverflow(page); await page.screenshot({ path: `${directory}/synthetic-dashboard-desktop.png` });
    await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click(); await page.reload();
    await expect(page.getByRole("button", { name: "Expand sidebar", exact: true })).toBeVisible(); checks++;
    await page.getByRole("button", { name: "Expand sidebar", exact: true }).click();
    step = "candidate directory and production entry points";
    await nav.getByRole("link", { name: "Candidates", exact: true }).click();
    await expect(page.getByRole("link", { name: "+ Add Candidate", exact: true })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Owner", exact: true })).toBeVisible(); checks++;
    await page.screenshot({ path: `${directory}/synthetic-candidates-desktop.png` });
    await nav.getByRole("link", { name: "Templates", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Template library", exact: true })).toBeVisible();
    const first = page.getByRole("region", { name: "Candidate results" }).locator("tbody tr").first().getByRole("link").first();
    await first.click(); await page.waitForURL(/\/studio\?/);
    step = "desktop studio, invalid source and mobile panels";
    await expect(page.getByRole("button", { name: "Select ATS Classic", exact: true })).toBeVisible();
    const panels = await page.locator(".studio-grid").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").map(Number.parseFloat));
    expect(panels.length).toBe(3); expect(panels[1] / panels[0]).toBeCloseTo(2, 1); checks++;
    await page.getByLabel("Original JSON response", { exact: true }).fill('{"invalid":');
    await page.getByRole("button", { name: "Validate JSON", exact: true }).click();
    await expect(page.getByLabel("Original JSON response", { exact: true })).toHaveValue('{"invalid":');
    await expect(page.locator("#json-validation").getByRole("alert")).not.toHaveCount(0); checks++;
    await noOverflow(page); await page.screenshot({ path: `${directory}/synthetic-studio-desktop.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("navigation", { name: "Resume Studio panels", exact: true })).toBeVisible();
    await page.getByRole("navigation", { name: "Resume Studio panels", exact: true }).getByRole("link", { name: "JSON editor", exact: true }).click();
    await expect(page.getByLabel("Original JSON response", { exact: true })).toBeInViewport(); checks++;
    await noOverflow(page); await page.screenshot({ path: `${directory}/synthetic-studio-mobile.png` });
    // The actual navigation preserves native unsaved-work guards.
    page.on("dialog", dialog => dialog.accept());
    step = "mobile modal navigation, focus and interview controls";
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Navigation", exact: true })).toBeVisible();
    await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "Open navigation", exact: true })).toBeFocused(); checks++;
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    await page.getByRole("dialog", { name: "Navigation", exact: true }).getByRole("link", { name: "Interviews", exact: true }).click();
    await expect(page.getByRole("searchbox", { name: "Search interviews", exact: true })).toBeVisible();
    await page.getByRole("list", { name: "Interview results", exact: true }).waitFor({ state: "attached" });
    await noOverflow(page); await page.screenshot({ path: `${directory}/synthetic-interviews-mobile.png` });
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    await page.getByRole("dialog", { name: "Navigation", exact: true }).getByRole("link", { name: "Account approvals", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Account approval", exact: true })).toBeVisible(); await noOverflow(page);
    step = "bidder navigation and direct interview denial";
    const bidder = await login(identities.bidderA);
    const bidderNav = bidder.getByRole("navigation", { name: "Main navigation", exact: true });
    for (const label of ["Interviews", "Candidates", "Resume Studio", "Account approvals", "Team & permissions"]) await expect(bidderNav.getByRole("link", { name: label, exact: true })).toHaveCount(0);
    await bidder.goto(`http://localhost:3000/interviews?organizationId=${org}`);
    await expect(bidder.getByRole("heading", { name: "Interview access unavailable", exact: true })).toBeVisible();
    const denied = await bidder.evaluate(async url => (await fetch(url, { credentials: "same-origin" })).status, `/api/v1/interviews?organizationId=${org}&search=true`);
    expect(denied).toBe(403); checks++;
    await expect(bidder.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
    return checks;
  } catch (e) { throw new Error(`Workspace UI ${step}: ${e.message}`); }
  finally { await Promise.all(contexts.map(c => c.close())); await browser.close(); }
}
