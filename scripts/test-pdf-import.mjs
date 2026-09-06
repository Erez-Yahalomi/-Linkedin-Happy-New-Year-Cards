import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse-legacy/lib/pdf-parse.js");
const filePath = process.argv[2];
if (!filePath) throw new Error("Usage: node scripts/test-pdf-import.mjs <file.pdf>");
const result = await pdfParse(await readFile(filePath));
if (!result.text.includes("Avery Patel")) throw new Error("Expected profile name was not extracted.");
console.log(JSON.stringify({ pages: result.numpages, characters: result.text.length, containsExpectedName: true }));
