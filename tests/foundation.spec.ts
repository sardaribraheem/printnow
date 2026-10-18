import { test, expect } from "@playwright/test";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
test("home starts a real local request without fabricating orders", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your next print, sorted." }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Sign in to post requests and keep track of your orders here.",
    ),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  await page.screenshot({
    path: testInfo.outputPath("home.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Create a print request" }).click();
  await expect(
    page.getByRole("heading", { name: "Your files, ready for a fresh start." }),
  ).toBeVisible();
});
test("mixed supported image selections count separate duplex sheets and copies", async ({
  page,
}) => {
  await page.goto("/requests/new");
  await page.locator("#upload-files").setInputFiles([
    { name: "notes.png", mimeType: "image/png", buffer: png },
    {
      name: "diagram.jpeg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("pending server decode"),
    },
  ]);
  await expect(page.getByText("notes.png", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Double-sided", exact: true }).click();
  await page.getByRole("button", { name: "More copies" }).click();
  await expect(
    page
      .locator("dl div")
      .filter({ has: page.locator("dt", { hasText: "Printed sides" }) })
      .locator("dd"),
  ).toHaveText("4*");
  await expect(
    page
      .locator("dl div")
      .filter({ has: page.locator("dt", { hasText: "Physical sheets" }) })
      .locator("dd"),
  ).toHaveText("4*");
  await page
    .getByRole("button", { name: "Remove notes.png", exact: true })
    .click();
  await expect(page.getByText("notes.png", { exact: true })).toHaveCount(0);
  await expect(
    page
      .locator("dl div")
      .filter({ has: page.locator("dt", { hasText: "Files" }) })
      .locator("dd"),
  ).toHaveText("1 selected");
});
test("PDF page totals are never invented before server validation", async ({
  page,
}) => {
  await page.goto("/requests/new");
  await page.locator("#upload-files").setInputFiles({
    name: "assignment.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7 pending validation"),
  });
  await expect(
    page.getByText("PDF totals appear after server validation."),
  ).toBeVisible();
  await expect(page.locator("dt", { hasText: "Printed sides" })).toHaveCount(0);
  await expect(
    page.getByText(
      "Files stay on your device until you choose Upload & review.",
    ),
  ).toBeVisible();
});
test("unsupported files fail with a clear selection error", async ({
  page,
}) => {
  await page.goto("/requests/new");
  await page.locator("#upload-files").setInputFiles({
    name: "assignment.docx",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("unsupported"),
  });
  await expect(page.locator("main [role=alert]")).toHaveText(
    "Choose PDF, PNG or JPEG files.",
  );
  await expect(page.locator(".file-list li")).toHaveCount(0);
});
test("provider application cannot claim submission without a backend", async ({
  page,
}) => {
  await page.goto("/printers");
  await page
    .getByRole("link", { name: "Apply as a printing provider" })
    .click();
  await expect(
    page.getByRole("button", { name: "Submit application" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Sign in to submit your application."),
  ).toBeVisible();
});
test("unconfigured authentication is explicitly disabled", async ({ page }) => {
  await page.goto("/login?next=https://evil.example");
  await expect(page.getByRole("status")).toContainText(
    "Sign-in is being set up.",
  );
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeDisabled();
  await expect(
    page.locator("form[action]").first().locator("input[name=next]"),
  ).toHaveValue("/");
});
test("production rejects sandbox identities even when local settings exist", async ({
  request,
  baseURL,
}) => {
  const id = "10000000-0000-0000-0000-000000000004";
  const response = await request.post(baseURL + "/api/sandbox", {
    headers: { Origin: baseURL! },
    data: { id },
  });
  expect(response.status()).toBe(404);
  const session = await request.get(baseURL + "/api/marketplace/session", {
    headers: { Cookie: "printnow_sandbox=" + id },
  });
  expect(session.status()).toBe(401);
});
