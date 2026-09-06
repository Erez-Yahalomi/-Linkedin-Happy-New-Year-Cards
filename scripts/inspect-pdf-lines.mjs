import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse-legacy/lib/pdf-parse.js");
const path = process.argv[2];
if (!path) throw new Error("Usage: node scripts/inspect-pdf-lines.mjs <profile.pdf>");
const result = await pdfParse(await readFile(path));
const lines = result.text
  .replace(/\u0000/g, " ")
  .replace(/[ \t]+\n/g, "\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim()
  .split(/\n+/)
  .map((line) => line.replace(/\s+/g, " ").trim())
  .filter(Boolean);
console.log(lines.slice(0, 80).map((line, index) => `${index}: ${line}`).join("\n"));
