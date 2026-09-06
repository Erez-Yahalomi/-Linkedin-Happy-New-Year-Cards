import { unusedResumeFacts } from "../src/shared/rewrite-facts.ts";

const facts = [
  "Developing microservices using Java, C++, Kotlin and reactive programming",
  "Developing automation tools in JAVA",
  "Engineering Manager at Vi",
  "Backend team lead at Tufin"
];
const firstRemaining = unusedResumeFacts(facts, [facts[0]]);
if (firstRemaining.includes(facts[0]) || firstRemaining.length !== 3) {
  throw new Error(`First rewrite did not remove the used detail: ${JSON.stringify(firstRemaining)}`);
}
const secondRemaining = unusedResumeFacts(facts, [facts[0], facts[1]]);
if (secondRemaining.includes(facts[0]) || secondRemaining.includes(facts[1]) || secondRemaining.length !== 2) {
  throw new Error(`Second rewrite did not remove all used details: ${JSON.stringify(secondRemaining)}`);
}
console.log(JSON.stringify({
  originalFacts: facts,
  afterFirstCard: firstRemaining,
  afterSecondCard: secondRemaining
}, null, 2));
