import { extractPrioritizedResumeFacts } from "../src/shared/pdf-fact-selection.ts";

const lines = [
  "Shaked Eyal",
  "Engineering Manager at Vi",
  "Summary",
  "Engineering Manager and A blogger",
  "Experience",
  "Vi",
  "Engineering Manager",
  "February 2026 - Present (8 months)",
  "Tufin",
  "4 years 6 months",
  "Backend team lead",
  "July 2023 - February 2026 (2 years 8 months)",
  "Developing microservices using Java, C++, Kotlin and reactive programming",
  "Scrum master of my team",
  "Developing automation tools in JAVA",
  "Education"
];
const facts = extractPrioritizedResumeFacts(lines, "Shaked Eyal", "Engineering Manager at Vi");
const expected = ["Engineering Manager and A blogger", "Engineering Manager at Vi"];
if (JSON.stringify(facts) !== JSON.stringify(expected)) {
  throw new Error(`Expected About and latest-role facts ${JSON.stringify(expected)}, received ${JSON.stringify(facts)}`);
}
if (facts.some((fact) => /microservices|automation|backend team lead/i.test(fact))) {
  throw new Error(`Older-role information appeared despite two preferred sources: ${JSON.stringify(facts)}`);
}
console.log(JSON.stringify({ prioritizedFacts: facts, sources: ["Summary", "Most recent role headline"] }, null, 2));
