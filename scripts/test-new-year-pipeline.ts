import { readFile } from "node:fs/promises";
import { parseGreeting } from "../src/shared/new-year-card.ts";
import type { ProfileInput } from "../src/shared/contracts.ts";

const completionPath = process.argv[2];
if (!completionPath) throw new Error("Usage: npx tsx scripts/test-new-year-pipeline.ts <completion.json>");
const profile: ProfileInput = {
  fullName: "Shaked Eyal",
  headline: "Engineering Manager at Vi",
  company: "Vi",
  location: "Modiin-Maccabim-Reut, Israel",
  profileNotes: "",
  resumeFacts: [
    "Developing microservices using Java, C++, Kotlin and reactive programming",
    "Developing automation tools in JAVA",
    "Engineering Manager at Vi",
    "Backend team lead at Tufin"
  ],
  occasion: "Happy New Year",
  relationship: "",
  senderName: "Alex",
  tone: "warm",
  theme: "confetti"
};
const rawResponse = JSON.parse(await readFile(completionPath, "utf8"));
const card = parseGreeting(String(rawResponse.content || ""), profile);
const message = card.message;
const wordCount = message.split(/\s+/).filter(Boolean).length;
if (!/^Dear Shaked, Happy New Year!/i.test(message)) throw new Error(`Missing personal New Year opening: ${message}`);
if (wordCount < 48 || wordCount > 90) throw new Error(`Unexpected card length (${wordCount} words): ${message}`);
if (!/\b(?:you|your)\b/i.test(message)) throw new Error(`Card is not addressed to Shaked: ${message}`);
if (/\b(?:i|me|my|mine|we|our|ours|us)\b/i.test(message)) throw new Error(`Card contains first-person language: ${message}`);
if (/\b(?:curriculum vitae|résumé|resume|experience|qualifications|skills|responsibilities|profile|career summary)\b/i.test(message)) throw new Error(`Card sounds like a résumé: ${message}`);
if (!/microservices|java|kotlin|reactive|automation|engineering manager|backend team lead/i.test(message)) throw new Error(`Card does not use a verified résumé fact: ${message}`);
console.log(JSON.stringify({ finalCard: message, wordCount, usedFacts: card.usedFacts }, null, 2));
