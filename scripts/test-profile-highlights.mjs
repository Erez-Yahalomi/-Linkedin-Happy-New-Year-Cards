import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse-legacy/lib/pdf-parse.js");
const path = process.argv[2];
if (!path) throw new Error("Usage: node scripts/test-profile-highlights.mjs <profile.pdf>");

const text = (await pdfParse(await readFile(path))).text
  .replace(/\u0000/g, " ")
  .replace(/[ \t]+\n/g, "\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim();
const lines = text.split(/\n+/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
const actionPattern = /\b(led|built|launched|managed|created|developed|developing|designed|delivered|improved|grew|increased|reduced|founded|co-founded|mentored|advised|awarded|recognized|published|implemented|directed|transformed|achieved|responsible for)\b/i;
const rolePattern = /\b(engineering manager|team lead|software engineer|software developer|scrum master|architect|director|product manager|developer)\b/i;
const skillsPattern = /\b(java|kotlin|c\+\+|reactive programming|microservices|automation|complex systems|databases)\b/i;
const dateOnlyPattern = /^(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\s*-\s*(?:(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}|present)\s*(?:\([^)]*\))?$/i;
const excludedNameLine = /linkedin|resume|curriculum|profile|experience|education|contact|top skills|skills|languages|certifications|publications|summary|page \d+|complex systems|team leadership|performance servers/i;
const emailHandles = lines.filter((line) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(line)).map((line) => line.split("@")[0].toLowerCase().replace(/[^a-z]/g, ""));
const recipientName = lines.slice(0, 100)
  .map((line, index) => ({ line, index }))
  .filter(({ line }) => {
    const words = line.split(/\s+/).filter(Boolean);
    return words.length >= 2 && words.length <= 4 && line.length < 80 && !excludedNameLine.test(line)
      && words.every((word) => /^[A-Z][A-Za-z'’-]*$/.test(word));
  })
  .map((candidate) => {
    const compact = candidate.line.toLowerCase().replace(/[^a-z]/g, "");
    const reverseCompact = candidate.line.split(/\s+/).reverse().join("").toLowerCase().replace(/[^a-z]/g, "");
    const emailMatch = emailHandles.some((handle) => handle === compact || handle === reverseCompact) ? 20 : 0;
    const profileContext = /\b(?:manager|engineer|developer|director|lead|founder|consultant|designer|analyst|specialist)\b/i.test(lines.slice(candidate.index + 1, candidate.index + 3).join(" ")) ? 4 : 0;
    return { ...candidate, score: emailMatch + profileContext - candidate.index / 1000 };
  })
  .sort((a, b) => b.score - a.score)[0]?.line;
if (recipientName !== "Shaked Eyal") throw new Error(`Expected recipient name Shaked Eyal, received: ${recipientName || "none"}`);
const facts = lines
  .map((line) => line.replace(/^[•\-*–—\d.()\s]+/, "").trim())
  .filter((line) => line.length >= 12 && line.length <= 320 && !dateOnlyPattern.test(line))
  .map((line) => ({ line, score: (actionPattern.test(line) ? 5 : 0) + (skillsPattern.test(line) ? 4 : 0) + (rolePattern.test(line) ? 2 : 0) }))
  .filter(({ score }) => score > 0)
  .sort((a, b) => b.score - a.score)
  .map(({ line }) => line)
  .filter((line, index, all) => all.findIndex((item) => item.toLowerCase() === line.toLowerCase()) === index)
  .slice(0, 6);
if (!facts.some((fact) => /microservices|scrum master|engineering manager|backend team lead/i.test(fact))) {
  throw new Error(`Expected an Eyal résumé highlight, received: ${JSON.stringify(facts)}`);
}
if (facts.some((fact) => dateOnlyPattern.test(fact))) throw new Error(`Date-only line incorrectly selected: ${JSON.stringify(facts)}`);
console.log(JSON.stringify({ recipientName, highlights: facts }, null, 2));
