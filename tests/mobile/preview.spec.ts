import { expect, test } from "@playwright/test";
test("native home prioritizes uploading and exposes four phone tabs", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Upload & Print" }),
  ).toBeVisible();
  await expect(page.getByText(/PREVIEW MODE/)).toBeVisible();
  for (const tab of ["Home", "Orders", "Messages", "Account"])
    await expect(
      page.getByRole("tab", { name: new RegExp(tab) }),
    ).toBeVisible();
  await page.getByRole("tab", { name: /Orders/ }).click();
  await expect(page.getByText("Nothing in the queue yet")).toBeVisible();
  await page.getByRole("tab", { name: /Messages/ }).click();
  await expect(
    page.getByText("A conversation starts with an order"),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Account/ }).click();
  await expect(page.getByText("Sample account", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("a selected image reaches explicit consent and sample printer offers", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload & Print" }).click();
  await (
    await chooser
  ).setFiles({
    name: "assignment.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY4sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(
    page.getByText("assignment.png", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Preview assignment.png", exact: true })
    .click();
  await expect(
    page.getByText(/On this device · No cloud upload/),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "assignment.png" })).toBeVisible();
  await page.getByRole("link", { name: "New print, back" }).click();
  await expect(
    page.getByText("1 pages · 1 printed sides · 1 sheets"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Review request" }).click();
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Create sample request" }).click();
  await expect(page.getByText("Ready to get offers?")).toBeVisible();
  await page.getByLabel("Consent to provider document review").check();
  await page.getByRole("button", { name: "Show sample offers" }).click();
  await expect(page.getByText("Choose your printer")).toBeVisible();
  await expect(
    page.getByText("Campus Print Studio", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Paper & Ink", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Choose this printer" })
    .first()
    .click();
  await expect(
    page.getByText("Your order", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Collection details")).toBeVisible();
});
