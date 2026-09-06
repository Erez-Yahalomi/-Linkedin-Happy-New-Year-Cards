import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extractPrioritizedResumeFacts } from "../src/shared/pdf-fact-selection.ts";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse-legacy/lib/pdf-parse.js") as (data: Buffer) => Promise<{ text: string }>;
const filePath = process.argv[2];
if (!filePath) throw new Error("Usage: npx tsx scripts/test-attached-pdf-priority.ts <profile.pdf>");
const parsed = await pdfParse(await readFile(filePath));
const lines = parsed.text
  .replace(/\u0000/g, " ")
  .replace(/[ \t]+\n/g, "\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim()
  .split(/\n+/)
  .map((line) => line.replace(/\s+/g, " ").trim())
  .filter(Boolean);
const facts = extractPrioritizedResumeFacts(lines, "Shaked Eyal", "Engineering Manager at Vi");
const expected = ["Engineering Manager and A blogger", "Engineering Manager at Vi"];
if (JSON.stringify(facts) !== JSON.stringify(expected)) {
  throw new Error(`Expected Summary and current-role facts ${JSON.stringify(expected)}, received ${JSON.stringify(facts)}`);
}
console.log(JSON.stringify({ recipient: "Shaked Eyal", prioritizedFacts: facts, sources: ["Summary", "Most recent role"] }, null, 2));
