import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const PDFJS = require("pdf-parse-legacy/lib/pdf.js/v1.10.100/build/pdf.js");
PDFJS.disableWorker = true;
const path = process.argv[2];
if (!path) throw new Error("Usage: node scripts/inspect-pdf-heading-layout.mjs <profile.pdf>");
const doc = await PDFJS.getDocument(await readFile(path));
const page = await doc.getPage(1);
const content = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
const items = content.items.map((item) => ({
  text: String(item.str).replace(/\s+/g, " ").trim(),
  x: Math.round(item.transform[4]),
  y: Math.round(item.transform[5]),
  width: Math.round(item.width || 0),
  height: Math.round(item.height || Math.abs(item.transform[0]) || 0)
})).filter((item) => item.text);
console.log(JSON.stringify(items.filter((item) => item.y > 500 || item.height >= 16).slice(0, 40), null, 2));
await doc.destroy();
