import { chromium, expect } from "@playwright/test";
import { createHash } from "node:crypto";
export async function testResumeBrowser({ org, candidate, identities, password }) {
  const browser = await chromium.launch(); const context = await browser.newContext({ acceptDownloads: true }); const page = await context.newPage(); page.setDefaultTimeout(20000);
  let step = "sign in"; let checks = 0;
  page.on("dialog", dialog => dialog.accept());
  try {
    await page.goto("http://localhost:3000/sign-in"); await page.getByLabel("Email", { exact: true }).fill(identities.adminA.email); await page.getByLabel("Password", { exact: true }).fill(password); await page.getByRole("button", { name: "Sign in", exact: true }).click(); await page.waitForURL("**/workspace");
    step = "open studio and assemble exact prompt";
    await page.goto(`http://localhost:3000/candidates/${candidate}/studio?organizationId=${org}`);
    step = "template search, selection and customization";
    await page.getByLabel("Search templates", { exact: true }).fill("Modern");
    const thumbnail=page.getByAltText("Modern Professional: first page of the shared synthetic resume",{exact:true});
    await expect(thumbnail).toBeVisible(); await expect.poll(()=>thumbnail.evaluate(image=>image.naturalWidth)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Select Modern Professional", exact: true }).click();
    await page.getByRole("button", { name: "Duplicate / customize Modern Professional", exact: true }).click();
    await page.getByLabel("Template name", { exact: true }).fill("Synthetic browser custom");
    await page.getByLabel("Template fontSize", { exact: true }).fill("11");
    await page.getByRole("button", { name: "Publish template", exact: true }).click();
    await page.getByLabel("Search templates", { exact: true }).fill("Synthetic browser custom");
    await expect(page.getByRole("button", { name: "Select Synthetic browser custom", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Select Synthetic browser custom", exact: true }).click();
    await page.getByLabel("Search templates", { exact: true }).fill("");
    step = "assemble prompt using selected custom template";
    await page.getByLabel("Target company", { exact: true }).fill("Synthetic Browser Target"); await page.getByLabel("Target role", { exact: true }).fill("Engineer"); await page.getByLabel("Reviewed job description", { exact: true }).fill("Reviewed synthetic job text.");
    await page.getByRole("button", { name: "Assemble prompt", exact: true }).click(); await expect(page.getByLabel("Exact prompt preview", { exact: true })).toHaveValue(/PROTECTED RULES/); checks++;
    step = "exact clipboard and independent denial";
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:3000" });
    const prompt = await page.getByLabel("Exact prompt preview", { exact: true }).inputValue(); await page.getByRole("button", { name: "Copy Prompt", exact: true }).click(); await expect(page.getByTestId("outcome-clipboard")).toHaveText("succeeded");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(prompt); checks++;
    await page.evaluate(() => { Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new DOMException("denied", "NotAllowedError")) } }); });
    await page.getByRole("button", { name: "Copy Prompt", exact: true }).click(); await expect(page.getByTestId("outcome-clipboard")).toHaveText("failed"); await expect(page.getByLabel("Exact prompt preview", { exact: true })).toHaveValue(prompt); checks++;
    step = "invalid JSON retained across format and reload";
    const raw = '{"company":'; await page.getByLabel("Original JSON response", { exact: true }).fill(raw); await page.getByRole("button", { name: "Validate JSON", exact: true }).click(); await expect(page.getByTestId("outcome-validation")).toHaveText("failed");
    await page.getByRole("button", { name: "Format JSON", exact: true }).click(); await expect(page.getByLabel("Original JSON response", { exact: true })).toHaveValue(raw);
    await page.waitForTimeout(300); await page.reload(); await expect(page.getByLabel("Original JSON response", { exact: true })).toHaveValue(raw); checks++;
    step = "review verified source and PDF preview";
    await page.getByRole("button", { name: "Load verified facts", exact: true }).click(); await page.getByRole("button", { name: "Validate JSON", exact: true }).click(); await expect(page.getByTestId("factual-status")).toHaveText("Facts reviewed against the frozen profile");
    await page.getByRole("button", { name: "Generate PDF", exact: true }).click(); await expect(page.getByTestId("outcome-pdfGeneration")).toHaveText("succeeded"); await expect(page.getByTestId("pdf-preview-status")).toContainText("from the frozen export bytes"); checks++;
    const hash = await page.getByTestId("pdf-hash").textContent(); const operation = await page.getByTestId("operation-id").textContent();
    step = "exact export bytes and truthful local result";
    const downloadPromise = page.waitForEvent("download"); await page.getByRole("button", { name: "Export PDF", exact: true }).click(); const download = await downloadPromise; const stream = await download.createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk);
    expect(createHash("sha256").update(Buffer.concat(chunks)).digest("hex")).toBe(hash); await expect(page.getByTestId("outcome-localExport")).toHaveText("initiated"); await expect(page.getByTestId("outcome-databaseSync")).toHaveText("idle"); checks++;
    step = "uncertain synchronization retains exact PDF and original operation";
    await page.route("**/api/v1/resume-versions?*", route => route.request().method() === "POST" ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ requestId: "synthetic-failure", error: { code: "SERVICE_UNAVAILABLE", message: "Synthetic synchronization failure", fieldErrors: [], retryable: true } }) }) : route.continue());
    await page.getByRole("button", { name: "Save reviewed source", exact: true }).click(); await expect(page.getByTestId("outcome-databaseSync")).toHaveText("unknown"); await expect(page.getByTestId("outcome-localExport")).toHaveText("initiated"); await expect(page.getByTestId("pdf-hash")).toHaveText(hash); checks++;
    await page.waitForTimeout(300); await page.reload(); await expect(page.getByTestId("outcome-databaseSync")).toHaveText("unknown"); await expect(page.getByTestId("operation-id")).toHaveText(operation); await expect(page.getByTestId("pdf-hash")).toHaveText(hash); checks++;
    await page.unroute("**/api/v1/resume-versions?*");
    step = "retry original frozen synchronization and historical view";
    await page.getByRole("button", { name: "Retry original synchronization", exact: true }).first().click(); await expect(page.getByTestId("outcome-databaseSync")).toHaveText("succeeded"); await expect(page.getByTestId("operation-id")).toHaveText(operation); await expect(page.getByTestId("pdf-hash")).toHaveText(hash); checks++;
    return checks;
  } catch {
    const ui = await page.locator('h1,h2,[role="alert"],[role="status"]').allTextContents().catch(() => []);
    throw new Error(`Resume browser acceptance failed during: ${step}; UI: ${JSON.stringify(ui).slice(0, 1200)}`);
  } finally { await context.close(); await browser.close(); }
}
