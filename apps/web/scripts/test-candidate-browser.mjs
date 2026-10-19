// Called only inside the guarded local-Supabase CI harness. No persisted Auth
// storage state, traces, HAR, screenshots, videos or credential logging.
import { chromium, expect } from "@playwright/test";

export async function testCandidateBrowser({ org, team, identities, password }) {
  const browser = await chromium.launch();
  let step = "browser initialization"; let checks = 0; let observedPage;
  const statuses = [];
  const contexts = [];
  async function login(person) {
    const context = await browser.newContext(); contexts.push(context);
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    observedPage = page; step = "open sign-in page";
    page.on("response", response => {
      const path = new URL(response.url()).pathname;
      if (["/auth/v1/token", "/sign-in", "/workspace", "/candidates"].includes(path)) statuses.push({ path, status: response.status() });
    });
    await page.goto("http://localhost:3000/sign-in");
    step = "fill sign-in form";
    await page.getByLabel("Email", { exact: true }).fill(person.email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    step = "sign-in reaches authorized workspace";
    await page.waitForURL("**/workspace");
    return { context, page };
  }
  const save = async (page, version) => {
    await page.getByRole("button", { name: "Save profile", exact: true }).click();
    await expect(page.getByTestId("profile-version")).toHaveText(String(version));
  };
  const tab = (page, name) => page.getByRole("navigation", { name: "Candidate tabs" }).getByRole("button", { name, exact: true }).click();
  try {
    step = "real browser sign-in and draft creation";
    const admin = await login(identities.adminA); const page = admin.page;
    step = "open candidate directory";
    await page.goto(`http://localhost:3000/candidates?organizationId=${org}`);
    step = "fill candidate creation form";
    await page.getByLabel("Full name (optional)", { exact: true }).fill("Synthetic Browser Avery");
    await page.getByLabel("Owning team", { exact: true }).selectOption(team);
    await page.getByRole("button", { name: "Create draft", exact: true }).click();
    step = "created draft opens profile workspace";
    await page.waitForURL(/\/candidates\/[a-f0-9-]+\?/);
    const detailURL = page.url();
    await expect(page.getByTestId("profile-version")).toHaveText("1"); checks++;
    step = "Ready validation and refresh persistence";
    await page.getByLabel("Profile status", { exact: true }).selectOption("ready");
    await page.getByRole("button", { name: "Save profile", exact: true }).click();
    await expect(page.getByText("phone: Required for Ready.", { exact: false })).toBeVisible(); checks++;
    await page.getByLabel("Email", { exact: true }).fill("synthetic-browser@example.invalid");
    await page.getByLabel("Phone", { exact: true }).fill("+1 202 555 0123");
    await page.getByLabel("Location", { exact: true }).fill("Synthetic City");
    await save(page, 2);
    await page.reload();
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue("synthetic-browser@example.invalid");
    await expect(page.getByLabel("Profile status", { exact: true })).toHaveValue("ready"); checks++;
    step = "structured work history, precision and ordering";
    await page.getByRole("button", { name: "Add work experience", exact: true }).click();
    await page.getByLabel("Official historical job title", { exact: true }).fill("Official Engineer II");
    await page.getByLabel("Company", { exact: true }).fill("Synthetic First Co");
    await page.getByLabel("Employment start date", { exact: true }).fill("2020-03");
    await page.getByRole("button", { name: "Add work experience", exact: true }).click();
    await page.getByLabel("Official historical job title", { exact: true }).nth(1).fill("Official Engineer III");
    await page.getByLabel("Company", { exact: true }).nth(1).fill("Synthetic Second Co");
    await save(page, 3);
    await page.getByRole("button", { name: "Move Work experience 2 up", exact: true }).click();
    await save(page, 4); await page.reload();
    await expect(page.getByLabel("Company", { exact: true }).first()).toHaveValue("Synthetic Second Co");
    await expect(page.getByLabel("Employment start date", { exact: true }).nth(1)).toHaveValue("2020-03"); checks++;
    step = "two browser tabs and explicit conflict recovery";
    const second = await admin.context.newPage(); await second.goto(detailURL);
    await page.getByLabel("Full name", { exact: true }).fill("Synthetic Browser Current"); await save(page, 5);
    await second.getByLabel("Full name", { exact: true }).fill("Synthetic Browser Merged");
    await second.getByRole("button", { name: "Save profile", exact: true }).click();
    await expect(second.getByRole("heading", { name: "Resolve edit conflict" })).toBeVisible();
    await expect(second.getByLabel("Full name", { exact: true })).toHaveValue("Synthetic Browser Merged"); checks++;
    await second.getByRole("button", { name: "Compare with current profile" }).click();
    await second.getByLabel("Keep my full name", { exact: true }).check();
    await second.getByRole("button", { name: "Use merged draft", exact: true }).click();
    await expect(second.getByTestId("profile-version")).toHaveText("5");
    await save(second, 6); await second.reload();
    await expect(second.getByLabel("Full name", { exact: true })).toHaveValue("Synthetic Browser Merged"); checks++;
    step = "manager assignment controls and assigned member editing";
    await page.reload(); await tab(page, "Overview");
    await page.getByLabel("Assign team member", { exact: true }).selectOption(identities.memberA.id);
    await page.getByRole("button", { name: "Assign member", exact: true }).click();
    await expect(page.getByTestId("profile-version")).toHaveText("7"); checks++;
    const member = await login(identities.memberA);
    await member.page.goto(detailURL);
    await member.page.getByLabel("Private notes", { exact: true }).fill("Synthetic member saved note");
    await save(member.page, 8);
    await tab(member.page, "Overview");
    await expect(member.page.getByRole("button", { name: "Assign member", exact: true })).toHaveCount(0); checks++;
    step = "six tabs and preserved revision view";
    await page.reload();
    for (const name of ["Resumes", "Bids", "Interviews", "Activity"]) {
      await tab(page, name); await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    }
    await page.getByRole("button", { name: "View version 3", exact: true }).click();
    const historical = page.getByRole("region", { name: "Historical profile" });
    await expect(historical.getByLabel("Company", { exact: true }).first()).toHaveValue("Synthetic First Co");
    await expect(historical.getByLabel("Full name", { exact: true })).toBeDisabled(); checks++;
    step = "archive, refresh read-only, directory filters and restore";
    await tab(page, "Overview");
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Archive candidate", exact: true }).click();
    await expect(page.getByTestId("profile-version")).toHaveText("9");
    await page.reload(); await tab(page, "Profile");
    await expect(page.getByLabel("Full name", { exact: true })).toBeDisabled(); checks++;
    await page.goto(`http://localhost:3000/candidates?organizationId=${org}&q=Synthetic+Browser+Merged`);
    await expect(page.getByRole("link", { name: "Synthetic Browser Merged", exact: true })).toHaveCount(0); checks++;
    await page.getByLabel("Status", { exact: true }).selectOption("archived");
    await page.getByRole("button", { name: "Apply filters", exact: true }).click();
    await expect(page.getByRole("link", { name: "Synthetic Browser Merged", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Synthetic Browser Merged", exact: true }).click();
    await expect(page.getByRole("link", { name: "Candidate directory", exact: true })).toHaveAttribute("href", /status=archived/); checks++;
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Restore candidate", exact: true }).click();
    await expect(page.getByTestId("profile-version")).toHaveText("10"); checks++;
    step = "unrelated team and bidder UI boundaries";
    const leader = await login(identities.leaderBeta); await leader.page.goto(detailURL);
    await expect(leader.page.getByRole("heading", { name: "Candidate access unavailable" })).toBeVisible();
    await expect(leader.page.getByLabel("Private notes", { exact: true })).toHaveCount(0); checks++;
    const bidder = await login(identities.bidderA); await bidder.page.goto(detailURL);
    await expect(bidder.page.getByRole("heading", { name: "Candidate access unavailable" })).toBeVisible();
    await expect(bidder.page.getByRole("navigation", { name: "Candidate tabs" })).toHaveCount(0); checks++;
    return checks;
  } catch {
    // Playwright errors may embed DOM/network details. Only the fixed synthetic
    // test step is returned to CI output; credentials remain in memory.
    const headings = observedPage ? await observedPage.locator('h1,h2,[role="alert"],[role="status"]').allTextContents().catch(() => []) : [];
    throw new Error(`Candidate browser acceptance failed during: ${step}; UI: ${JSON.stringify(headings).slice(0, 800)}; statuses: ${JSON.stringify(statuses.slice(-8))}`);
  } finally {
    for (const context of contexts) await context.close();
    await browser.close();
  }
}
