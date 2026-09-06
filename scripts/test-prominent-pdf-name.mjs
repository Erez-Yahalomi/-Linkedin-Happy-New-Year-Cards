import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const PDFJS = require("pdf-parse-legacy/lib/pdf.js/v1.10.100/build/pdf.js");
PDFJS.disableWorker = true;
const path = process.argv[2];
if (!path) throw new Error("Usage: node scripts/test-prominent-pdf-name.mjs <profile.pdf>");
const excluded = /linkedin|resume|curriculum|profile|experience|education|contact|top skills|skills|languages|certifications|publications|summary|page \d+|complex systems|team leadership|performance servers/i;
function isNameCandidate(value) {
  const words = value.split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 4 && value.length < 80 && !excluded.test(value)
    && words.every((word) => /^[A-Z][A-Za-z'’-]*$/.test(word));
}
const doc = await PDFJS.getDocument(await readFile(path));
try {
  const page = await doc.getPage(1);
  const content = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
  const name = content.items.map((item) => ({
    text: String(item.str).replace(/\s+/g, " ").trim(),
    x: Number(item.transform?.[4] || 0),
    y: Number(item.transform?.[5] || 0),
    fontHeight: Number(item.height || Math.abs(item.transform?.[0] || 0))
  })).filter((item) => isNameCandidate(item.text) && item.x >= 170 && item.y >= (page.view[3] || 1) * 0.78 && item.fontHeight >= 18)
    .sort((a, b) => b.fontHeight - a.fontHeight || b.y - a.y || b.x - a.x)[0];
  if (name?.text !== "Shaked Eyal") throw new Error(`Expected prominent recipient name Shaked Eyal, received: ${JSON.stringify(name)}`);
  console.log(JSON.stringify({ recipientName: name.text, source: "prominent first-page main-column heading", x: name.x, y: name.y, fontHeight: name.fontHeight }, null, 2));
} finally {
  await doc.destroy();
}
