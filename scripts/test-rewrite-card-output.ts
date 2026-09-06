import { parseGreeting } from "../src/shared/new-year-card.ts";
import type { ProfileInput } from "../src/shared/contracts.ts";

const firstFact = "Developing microservices using Java, C++, Kotlin and reactive programming";
const rewriteFact = "Developing automation tools in JAVA";
const base: Omit<ProfileInput, "resumeFacts"> = {
  fullName: "Shaked Eyal",
  headline: "Engineering Manager at Vi",
  company: "Vi",
  location: "Modiin-Maccabim-Reut, Israel",
  profileNotes: "",
  occasion: "Happy New Year",
  relationship: "",
  senderName: "Alex",
  tone: "warm",
  theme: "confetti"
};
const firstCard = parseGreeting("not valid JSON", { ...base, resumeFacts: [firstFact] });
const rewriteCard = parseGreeting("not valid JSON", { ...base, resumeFacts: [rewriteFact] });
if (!firstCard.usedFacts.includes(firstFact)) throw new Error(`Initial card did not use its selected fact: ${JSON.stringify(firstCard)}`);
if (!rewriteCard.usedFacts.includes(rewriteFact) || rewriteCard.usedFacts.includes(firstFact)) {
  throw new Error(`Rewrite card did not use a different selected fact: ${JSON.stringify(rewriteCard)}`);
}
if (!/automation tools in JAVA/i.test(rewriteCard.message)) throw new Error(`Rewrite message did not personalize with the alternate PDF fact: ${rewriteCard.message}`);
console.log(JSON.stringify({ initialUsedFact: firstCard.usedFacts, rewriteUsedFact: rewriteCard.usedFacts, rewriteMessage: rewriteCard.message }, null, 2));
