import { afterEach, expect, it } from "vitest";
import { mkdtemp, writeFile, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import sharp from "sharp";
const run = promisify(execFile);
const folders: string[] = [];
afterEach(async () => {
  await Promise.all(
    folders.splice(0).map((p) => rm(p, { recursive: true, force: true })),
  );
});
async function processFile(bytes: Buffer, kind: string) {
  const folder = await mkdtemp(join(tmpdir(), "printnow-worker-test-"));
  folders.push(folder);
  const original = join(folder, "original");
  await writeFile(original, bytes);
  const result = await run(
    process.execPath,
    [
      "--max-old-space-size=256",
      "workers/process-file.mjs",
      original,
      folder,
      kind,
      String(bytes.length),
    ],
    { timeout: 15000, maxBuffer: 1024 * 1024 },
  );
  return { folder, result: JSON.parse(result.stdout) };
}
it("counts real PDF pages and removes document/page active content", async () => {
  const doc = await PDFDocument.create();
  doc.addJavaScript("test", 'app.alert("should never survive");');
  for (let i = 0; i < 5; i++) {
    const page = doc.addPage();
    page.node.set(
      PDFName.of("AA"),
      doc.context.obj({
        O: {
          S: PDFName.of("JavaScript"),
          JS: PDFString.of('app.alert("bad");'),
        },
      }),
    );
  }
  const { folder, result } = await processFile(
    Buffer.from(await doc.save()),
    "pdf",
  );
  expect(result.pages).toBe(5);
  expect(result.checksum).toMatch(/^[0-9a-f]{64}$/);
  const cleaned = await PDFDocument.load(
    await readFile(join(folder, "print.pdf")),
  );
  expect(cleaned.catalog.has(PDFName.of("Names"))).toBe(false);
  for (const page of cleaned.getPages())
    expect(page.node.has(PDFName.of("AA"))).toBe(false);
  expect((await stat(join(folder, "preview.png"))).size).toBeGreaterThan(0);
});
it("normalizes transparent PNG and JPEG to one-page print PDFs", async () => {
  for (const kind of ["png", "jpeg"]) {
    const source = sharp({
      create: { width: 100, height: 150, channels: 4, background: "#f0eee080" },
    });
    const bytes = await (
      kind === "png" ? source.png() : source.jpeg()
    ).toBuffer();
    const { result } = await processFile(bytes, kind);
    expect(result.pages).toBe(1);
  }
});
it("rejects corrupt PDFs, encrypted PDFs and forged image signatures", async () => {
  await expect(
    processFile(Buffer.from("%PDF-1.7 corrupt"), "pdf"),
  ).rejects.toThrow();
  await expect(
    processFile(await readFile("tests/fixtures/encrypted.pdf"), "pdf"),
  ).rejects.toThrow();
  await expect(
    processFile(Buffer.from("not actually an image"), "png"),
  ).rejects.toThrow();
});
