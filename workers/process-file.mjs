// Runs as a bounded child process. No network requests or source filenames are used.
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PDFDocument, PDFName } from "pdf-lib";
import sharp from "sharp";
const [input, output, kind, expectedBytes] = process.argv.slice(2);
const run = promisify(execFile);
const bytes = await readFile(input);
if (bytes.length !== Number(expectedBytes) || bytes.length > 25 * 1024 * 1024)
  throw new Error("SIZE_MISMATCH");
await mkdir(output, { recursive: true });
let pdf;
let width, height;
if (kind === "pdf") {
  if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-")))
    throw new Error("BAD_SIGNATURE");
  const source = await PDFDocument.load(bytes, { throwOnInvalidObject: true });
  if (
    source.isEncrypted ||
    source.getPageCount() < 1 ||
    source.getPageCount() > 1000
  )
    throw new Error("PDF_LIMIT");
  pdf = await PDFDocument.create();
  const pages = await pdf.copyPages(source, source.getPageIndices());
  for (const page of pages) {
    for (const key of ["Annots", "AA", "A", "PresSteps"])
      page.node.delete(PDFName.of(key));
    pdf.addPage(page);
  }
} else {
  const isPng = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if ((kind === "png" && !isPng) || (kind === "jpeg" && !isJpeg))
    throw new Error("BAD_SIGNATURE");
  const image = sharp(bytes, {
    limitInputPixels: 40000000,
    animated: false,
    failOn: "warning",
  });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1)
    throw new Error("IMAGE_LIMIT");
  const normalized = await image
    .rotate()
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
  const normalizedMeta = await sharp(normalized).metadata();
  width = normalizedMeta.width;
  height = normalizedMeta.height;
  pdf = await PDFDocument.create();
  const embedded = await pdf.embedPng(normalized);
  const page = pdf.addPage([595.28, 841.89]);
  const scale = Math.min(555 / embedded.width, 802 / embedded.height);
  const drawWidth = embedded.width * scale,
    drawHeight = embedded.height * scale;
  page.drawImage(embedded, {
    x: (595.28 - drawWidth) / 2,
    y: (841.89 - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  });
}
const derivative = join(output, "print.pdf");
await writeFile(derivative, await pdf.save({ useObjectStreams: true }));
if ((await stat(derivative)).size > 100 * 1024 * 1024)
  throw new Error("DERIVATIVE_LIMIT");
await run(
  "pdftoppm",
  [
    "-f",
    "1",
    "-l",
    "1",
    "-scale-to",
    "1000",
    "-png",
    "-singlefile",
    derivative,
    join(output, "preview"),
  ],
  { timeout: 20000, maxBuffer: 1024 * 1024 },
);
console.log(
  JSON.stringify({
    pages: pdf.getPageCount(),
    width,
    height,
    checksum: createHash("sha256").update(bytes).digest("hex"),
  }),
);
