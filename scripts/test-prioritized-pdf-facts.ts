import { extractPrioritizedResumeFacts } from "../src/shared/pdf-fact-selection.ts";

const lines = [
  "Shmo",
  "Engineering Manager at mo",
  "Summary",
  "Engineering Manager",
  "Experience",
  "mo",
  "Engineering Manager",
  "February 2026 - Present (8 months)",
  "Tu n",
  "4 years 6 months",
   
  "Education"
];
const facts = extractPrioritizedResumeFacts(lines, "Smo", "Engineering Manager at Vi");
const expected = ["Engineering Manager ", "Engineering Manager at mo"];
if (JSON.stringify(facts) !== JSON.stringify(expected)) {
  throw new Error(`Expected About and latest-role facts ${JSON.stringify(expected)}, received ${JSON.stringify(facts)}`);
}
if (facts.some((fact) => /microservices|automation|backend team lead/i.test(fact))) {
  throw new Error(`Older-role information appeared despite two preferred sources: ${JSON.stringify(facts)}`);
}
console.log(JSON.stringify({ prioritizedFacts: facts, sources: ["Summary", "Most recent role headline"] }, null, 2));
