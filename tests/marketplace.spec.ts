import { test, expect, type Browser } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import pg from "pg";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
const database = new pg.Pool({
  connectionString: "postgresql://postgres@127.0.0.1:55432/postgres",
  max: 2,
});
test.beforeAll(async () => {
  await database.query(
    "update public.print_requests set created_at=now()-interval '2 hours' where title like 'E2E %' and customer_id=$1",
    [customer],
  );
});
test.afterAll(async () => {
  await database.end();
});
const customer = "10000000-0000-0000-0000-000000000001",
  printerA = "10000000-0000-0000-0000-000000000002",
  printerB = "10000000-0000-0000-0000-000000000003";
async function context(browser: Browser, id: string, baseURL: string) {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await c.addCookies([{ name: "printnow_sandbox", value: id, url: baseURL }]);
  return c;
}
async function pdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 5; i++) {
    const page = doc.addPage();
    page.drawText(`Synthetic test notes. Page ${i + 1}`, {
      font,
      size: 22,
      x: 50,
      y: 700,
    });
  }
  return Buffer.from(await doc.save());
}
for (const mode of ["pickup", "delivery"] as const) {
  test(`${mode}: validated files, two offers, acceptance, private chat and completion`, async ({
    browser,
    baseURL,
  }, info) => {
    const origin = baseURL!;
    const c = await context(browser, customer, origin),
      a = await context(browser, printerA, origin),
      b = await context(browser, printerB, origin);
    const page = await c.newPage();
    const pa = await a.newPage(),
      pb = await b.newPage();
    try {
      await page.goto("/requests/new");
      await page.getByRole("button", { name: "Upload & review" }).waitFor();
      await page.getByLabel("Request title").fill(`E2E ${mode} ${Date.now()}`);
      await page
        .getByLabel("Search area / campus")
        .fill("University main gate");
      if (mode === "pickup")
        await page
          .getByRole("button", { name: "I’ll pick it up", exact: false })
          .click();
      if (mode === "delivery") {
        await page.getByRole("button", { name: "Bring it to me" }).click();
        await page.getByLabel("Recipient name").fill("Test Recipient");
        await page.getByLabel("Recipient phone").fill("03009999999");
        await page
          .getByLabel("Exact delivery address")
          .fill("PRIVATE TEST ROOM 7, UNIVERSITY RESIDENCE");
      }
      if (mode === "pickup") {
        await page.locator("#upload-files").setInputFiles({
          name: "five-page-notes.pdf",
          mimeType: "application/pdf",
          buffer: await pdf(),
        });
        await page
          .getByRole("button", { name: "Double-sided", exact: true })
          .click();
        await page.getByRole("button", { name: "More copies" }).click();
      } else {
        await page.locator("#upload-files").setInputFiles([
          {
            name: "image-one.png",
            mimeType: "image/png",
            buffer: await sharp({
              create: {
                width: 500,
                height: 700,
                channels: 3,
                background: "#f0efe4",
              },
            })
              .png()
              .toBuffer(),
          },
          {
            name: "image-two.jpeg",
            mimeType: "image/jpeg",
            buffer: await sharp({
              create: {
                width: 700,
                height: 500,
                channels: 3,
                background: "#dfe9d5",
              },
            })
              .jpeg()
              .toBuffer(),
          },
        ]);
      }
      await page.getByRole("button", { name: "Upload & review" }).click();
      await page.waitForURL(/\/requests\/[a-f0-9-]+$/);
      const requestPath = new URL(page.url()).pathname;
      const requestId = requestPath.split("/").pop()!;
      await expect(
        page.getByRole("button", { name: "Post request", exact: true }),
      ).toBeVisible({ timeout: 60000 });
      const before = await a.request.get(
        origin + "/api/marketplace/request/" + requestId,
      );
      expect(before.status()).toBe(403);
      await page.getByRole("checkbox", { name: /I agree to share/ }).check();
      await page
        .getByRole("button", { name: "Post request", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Printer offers", exact: true })
        .waitFor();
      const snapshot = await (
        await c.request.get(origin + "/api/marketplace/request/" + requestId)
      ).json();
      const fileId = snapshot.files[0].id;
      if (mode === "pickup") {
        expect(snapshot.total_sides).toBe(10);
        expect(snapshot.sheets).toBe(6);
      }
      const preView = await a.request.get(
        origin + `/api/files/${fileId}/view`,
        { headers: { Range: "bytes=0-9" } },
      );
      expect(preView.status()).toBe(206);
      expect(preView.headers()["cache-control"]).toBe("private, no-store");
      for (const [p, amount] of [
        [pa, "200"],
        [pb, "180"],
      ] as const) {
        await p.goto(requestPath);
        await p.getByLabel("Printing amount (Rs.)").fill(amount);
        if (mode === "delivery")
          await p.getByLabel("Delivery amount (Rs.)").fill("100");
        await p
          .getByLabel(
            mode === "pickup"
              ? "Ready within (minutes)"
              : "Delivered within (minutes)",
          )
          .fill("20");
        await p.getByRole("button", { name: "Send 5-minute offer" }).click();
        await p
          .getByRole("heading", { name: "Your previous offers" })
          .waitFor();
      }
      const feed = await (
        await a.request.get(origin + "/api/marketplace/feed")
      ).text();
      expect(feed).not.toContain("PRIVATE TEST ROOM");
      expect(feed).not.toContain("03009999999");
      await expect(
        page.getByRole("button", { name: "Choose this printer" }),
      ).toHaveCount(2);
      await page.screenshot({
        path: info.outputPath(mode + "-offers.png"),
        fullPage: true,
      });
      // Explicitly select Paper & Ink, regardless of offer arrival order.
      await page
        .locator(".offer-card")
        .filter({
          has: page.getByRole("heading", { name: "Paper & Ink", exact: true }),
        })
        .getByRole("button", { name: "Choose this printer" })
        .click();
      await page
        .getByRole("button", { name: "Confirm printer", exact: true })
        .click();
      await page.waitForURL(/\/orders\//);
      const orderPath = new URL(page.url()).pathname;
      expect(
        (
          await a.request.get(origin + `/api/files/${fileId}/view`, {
            headers: { Range: "bytes=0-9" },
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await b.request.get(origin + `/api/files/${fileId}/view`, {
            headers: { Range: "bytes=0-9" },
          })
        ).status(),
      ).toBe(206);
      await page
        .getByLabel("Message", { exact: true })
        .fill("Please confirm when my prints are ready.");
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await expect(
        page.getByText("Please confirm when my prints are ready.", {
          exact: true,
        }),
      ).toBeVisible();
      await pb.goto(orderPath);
      await expect(
        pb.getByText("Please confirm when my prints are ready.", {
          exact: true,
        }),
      ).toBeVisible();
      if (mode === "delivery")
        await expect(
          pb.getByText("PRIVATE TEST ROOM 7, UNIVERSITY RESIDENCE", {
            exact: true,
          }),
        ).toBeVisible();
      for (const next of [
        "printing",
        "ready",
        ...(mode === "delivery" ? ["out for delivery"] : []),
        "handover reported",
      ]) {
        await pb
          .getByRole("button", { name: "Mark " + next, exact: true })
          .click();
        await expect(pb.locator(".detail-heading .status-pill")).toHaveText(
          next,
          { ignoreCase: true },
        );
      }
      await page
        .getByRole("button", { name: "I paid the printer", exact: true })
        .click();
      await pb
        .getByRole("button", { name: "Payment received", exact: true })
        .click();
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .getByRole("button", { name: "Confirm received", exact: true })
        .click();
      await expect(page.locator(".detail-heading .status-pill")).toHaveText(
        "Completed",
      );
      await expect(
        page.getByText("Customer: Paid · Printer: Received"),
      ).toBeVisible();
      await page.reload();
      await expect(page.locator(".detail-heading .status-pill")).toHaveText(
        "Completed",
      );
      await page.screenshot({
        path: info.outputPath(mode + "-completed.png"),
        fullPage: true,
      });
      const result = await (
        await c.request.get(
          origin + "/api/marketplace/order/" + orderPath.split("/").pop(),
        )
      ).json();
      expect(result.commission_bps_snapshot).toBe(0);
      expect(result.platform_fee_paisa).toBe(0);
    } finally {
      await c.close();
      await a.close();
      await b.close();
    }
  });
}
test("sandbox accounts are visibly labelled and API mutations reject cross-origin requests", async ({
  page,
  request,
  baseURL,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Development sandbox", { exact: true }),
  ).toBeVisible();
  const response = await request.post(baseURL + "/api/sandbox", {
    headers: { Origin: "https://unrelated.example" },
    data: { id: customer },
  });
  expect(response.status()).toBe(403);
});
test("onboarding keeps private setup in one tab during auth and permits manual location", async ({
  browser,
  baseURL,
}) => {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await c.newPage();
  await c.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (
          _success: unknown,
          failure: (e: { code: number }) => void,
        ) => failure({ code: 1 }),
      },
    });
  });
  try {
    await page.goto("/onboarding");
    await page.getByRole("button", { name: "Skip intro" }).click();
    await page.getByLabel("Your name", { exact: true }).fill("Ayesha Khan");
    await page.getByLabel("Contact phone", { exact: true }).fill("03000000000");
    await page
      .getByRole("button", { name: "Deliver to me", exact: true })
      .click();
    await page
      .getByLabel("Default delivery address")
      .fill("TAB_ONLY_TEST_ADDRESS, campus road");
    await page.getByRole("button", { name: "Use my current location" }).click();
    await expect(
      page.getByText(/Location access wasn’t available/),
    ).toBeVisible();
    await page.getByLabel("Latitude", { exact: true }).fill("31.5204");
    await page.getByLabel("Longitude", { exact: true }).fill("74.3587");
    await page.getByRole("button", { name: "Continue to sign in" }).click();
    await page.waitForURL(/\/login\?next=\/onboarding/);
    expect(page.url()).not.toContain("TAB_ONLY");
    // Simulate a completed local authentication callback; no email or OAuth provider is contacted.
    await c.addCookies([
      { name: "printnow_sandbox", value: customer, url: baseURL! },
    ]);
    await page.goto("/onboarding");
    await expect(page.getByLabel("Default delivery address")).toHaveValue(
      "TAB_ONLY_TEST_ADDRESS, campus road",
    );
    await page.getByRole("button", { name: "Save & continue" }).click();
    await page.waitForURL(/\/requests\/new/);
    expect(
      await page.evaluate(() => sessionStorage.getItem("printnow-onboarding")),
    ).toBeNull();
    const session = await (
      await c.request.get(baseURL + "/api/marketplace/session")
    ).json();
    expect(session.address.full_address).toBe(
      "TAB_ONLY_TEST_ADDRESS, campus road",
    );
    expect(session.address.lat).toBeCloseTo(31.5204);
    await expect(page.getByLabel("Exact delivery address")).toHaveValue(
      "TAB_ONLY_TEST_ADDRESS, campus road",
    );
    await expect(page.getByLabel("Latitude", { exact: true })).toHaveValue(
      "31.5204",
    );
  } finally {
    await c.close();
  }
});
test("dispute holds preserve actual objects and resolved retention deletes them", async ({
  browser,
  baseURL,
}) => {
  const c = await context(browser, customer, baseURL!),
    admin = await context(
      browser,
      "10000000-0000-0000-0000-000000000004",
      baseURL!,
    );
  try {
    const f = (
      await database.query(
        "select f.*,o.id order_id from public.request_files f join public.print_requests r on r.id=f.request_id join public.orders o on o.request_id=r.id where r.title like 'E2E %' and o.status='completed' and f.processing_state='ready' order by r.created_at desc limit 1",
      )
    ).rows[0];
    expect(f).toBeTruthy();
    const response = await c.request.post(baseURL + "/api/marketplace/issue", {
      headers: { Origin: baseURL! },
      data: {
        id: f.order_id,
        category: "wrong_output",
        description: "Synthetic evidence retention test",
      },
    });
    expect(response.status()).toBe(200);
    const issue = await response.json();
    await database.query(
      "update public.request_files set delete_after=now()-interval '1 day' where id=$1",
      [f.id],
    );
    await run(
      process.execPath,
      [
        "--use-env-proxy",
        "--env-file=.env.local",
        "workers/runner.mjs",
        "--once",
      ],
      { timeout: 15000 },
    );
    expect(
      (await c.request.get(baseURL + `/api/files/${f.id}/view`)).status(),
    ).toBe(200);
    const scoped = await admin.request.get(
      baseURL + "/api/marketplace/case/" + issue.id,
    );
    expect(scoped.status()).toBe(200);
    expect(
      (
        await admin.request.get(
          baseURL + `/api/files/${f.id}/view?case=${issue.id}`,
        )
      ).status(),
    ).toBe(200);
    expect(
      (await admin.request.get(baseURL + `/api/files/${f.id}/view`)).status(),
    ).toBe(403);
    const resolved = await admin.request.post(
      baseURL + "/api/marketplace/admin_resolve",
      {
        headers: { Origin: baseURL! },
        data: {
          id: issue.id,
          reason: "Synthetic retention test resolved by agreement",
        },
      },
    );
    expect(resolved.status()).toBe(200);
    await run(
      process.execPath,
      [
        "--use-env-proxy",
        "--env-file=.env.local",
        "workers/runner.mjs",
        "--once",
      ],
      { timeout: 15000 },
    );
    const state = (
      await database.query(
        "select processing_state from public.request_files where id=$1",
        [f.id],
      )
    ).rows[0].processing_state;
    expect(state).toBe("deleted");
    const root = join(process.cwd(), ".printnow-files");
    for (const [bucket, key] of [
      ["print-originals", f.object_key],
      ["print-previews", f.derivative_key],
      ["print-previews", f.preview_key],
    ])
      await expect(access(join(root, bucket, key))).rejects.toThrow();
    expect(
      (await c.request.get(baseURL + `/api/files/${f.id}/view`)).status(),
    ).not.toBe(200);
  } finally {
    await c.close();
    await admin.close();
  }
});
