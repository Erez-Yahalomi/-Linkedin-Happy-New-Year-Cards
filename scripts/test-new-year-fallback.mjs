import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parseGreeting } = require("../dist/main/gemma-service.cjs");

const profile = {
  fullName: "Shaked Eyal",
  headline: "Engineering Manager at Vi",
  company: "Vi",
  location: "Modiin-Maccabim-Reut, Israel",
  profileNotes: "",
  resumeFacts: ["Developing microservices using Java, C++, Kotlin and reactive programming"],
  occasion: "Happy New Year",
  relationship: "",
  senderName: "Alex",
  tone: "warm",
  theme: "confetti"
};
const unacceptableRawOutput = JSON.stringify({
  recipientName: "Shaked Eyal",
  message: "I am Shaked, an Engineering Manager with extensive experience developing microservices in Java, C++, Kotlin, and reactive programming. My profile shows a strong history of professional skills and responsibilities.",
  signature: "Alex"
});
const card = parseGreeting(unacceptableRawOutput, profile);
const message = card.message;
if (!/^Dear Shaked, Happy New Year!/i.test(message)) throw new Error(`Fallback did not create a New Year card: ${message}`);
if (/\b(?:i|me|my|mine|we|our|ours|us)\b/i.test(message)) throw new Error(`Fallback retained first-person voice: ${message}`);
if (/\b(?:curriculum vitae|résumé|resume|experience|qualifications|skills|responsibilities|profile|career summary)\b/i.test(message)) throw new Error(`Fallback retained résumé language: ${message}`);
if (!/microservices|java|kotlin|reactive/i.test(message)) throw new Error(`Fallback did not personalize using a résumé fact: ${message}`);
console.log(JSON.stringify({ fallbackMessage: message, usedFacts: card.usedFacts }, null, 2));
