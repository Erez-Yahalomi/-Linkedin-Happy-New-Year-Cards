import { fallbackGreeting } from "../src/shared/new-year-card.ts";
import type { ProfileInput } from "../src/shared/contracts.ts";

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
const aboutFact = "Engineering Manager and A blogger";
const recentRoleFact = "Engineering Manager at Vi";
const aboutCard = fallbackGreeting({ ...base, resumeFacts: [aboutFact] });
const recentRoleCard = fallbackGreeting({ ...base, resumeFacts: [recentRoleFact] });
if (!/thoughtful leadership and creativity/i.test(aboutCard.message) || !/engineering manager and blogger/i.test(aboutCard.message)) {
  throw new Error(`About fact was not expressed warmly: ${aboutCard.message}`);
}
if (!/Engineering Manager role at Vi/i.test(recentRoleCard.message)) {
  throw new Error(`Most recent role was not expressed naturally: ${recentRoleCard.message}`);
}
console.log(JSON.stringify({ aboutCard: aboutCard.message, recentRoleCard: recentRoleCard.message }, null, 2));
