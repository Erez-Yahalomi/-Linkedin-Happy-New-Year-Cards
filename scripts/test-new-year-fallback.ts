import { parseGreeting } from "../src/shared/new-year-card.ts";
import type { ProfileInput } from "../src/shared/contracts.ts";

const profile: ProfileInput = {
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
if (card.signature !== "With warm wishes, Alex") throw new Error(`Card should retain the personal closing and sender name, received: ${card.signature}`);
console.log(JSON.stringify({ fallbackMessage: message, signature: card.signature, usedFacts: card.usedFacts }, null, 2));
