import type { GreetingDraft, ProfileInput } from "./contracts.js";

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

function meaningfulWords(value: string): string[] {
  const ignored = new Set(["with", "from", "that", "this", "your", "their", "have", "been", "into", "team", "work", "role", "years", "year", "software", "engineering", "manager"]);
  return value.toLowerCase().match(/[a-z][a-z0-9+-]{1,}/g)?.filter((word) => !ignored.has(word)) || [];
}

function factsMentionedIn(message: string, facts: string[]): string[] {
  const text = message.toLowerCase();
  return facts.filter((fact) => {
    const words = meaningfulWords(fact);
    const matches = words.filter((word) => text.includes(word)).length;
    return matches >= Math.min(2, Math.max(1, words.length));
  });
}

function celebrateFact(fact: string): string {
  if (/^developing\s+/i.test(fact)) {
    return `The care and expertise behind your work ${fact.replace(/^developing\s+/i, "developing ")} are truly worth celebrating.`;
  }
  if (/^engineering manager\s+and\s+(?:a\s+)?blogger$/i.test(fact)) {
    return "The thoughtful leadership and creativity you bring as an engineering manager and blogger are truly worth celebrating.";
  }
  if (/^engineering manager at\s+/i.test(fact)) {
    return `The leadership you bring in your Engineering Manager role at ${fact.replace(/^engineering manager at\s+/i, "")} is truly worth celebrating.`;
  }
  if (/^backend team lead at\s+/i.test(fact)) {
    return `The leadership you brought as ${fact} is truly worth celebrating.`;
  }
  return `The dedication reflected in ${fact} is truly worth celebrating.`;
}

function cardSignature(senderName: string): string {
  const name = senderName.trim();
  return name ? `With warm wishes, ${name}` : "With warm wishes";
}

export function fallbackGreeting(profile: ProfileInput): GreetingDraft {
  const signature = cardSignature(profile.senderName);
  const fact = profile.resumeFacts?.[0];
  const factSentence = fact
    ? ` ${celebrateFact(fact)}`
    : " The thoughtful path you are creating is something truly worth celebrating.";
  return {
    recipientName: profile.fullName,
    headline: profile.headline,
    company: profile.company,
    occasion: "Happy New Year",
    message: `Dear ${firstName(profile.fullName)}, Happy New Year! May the year ahead bring you bright moments, renewed energy, and countless reasons to smile.${factSentence} Wishing you warmth, inspiration, and wonderful new possibilities throughout the year.`,
    signature,
    accent: "golden new year sparks",
    imagePrompt: `${profile.theme} New Year greeting-card background with warm golden light, abstract festive details, no text, no logos`,
    usedFacts: fact ? [fact] : []
  };
}

function isHeartfeltNewYearCard(message: string, profile: ProfileInput): boolean {
  const wordCount = message.trim().split(/\s+/).filter(Boolean).length;
  const recipient = firstName(profile.fullName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const directAddress = new RegExp(`^Dear\\s+${recipient},\\s*Happy New Year!`, "i");
  const firstPerson = /\b(?:i|me|my|mine|we|our|ours|us)\b/i;
  const resumeStyle = /\b(?:curriculum vitae|résumé|resume|experience|qualifications|skills|responsibilities|profile|career summary)\b/i;
  return directAddress.test(message)
    && /happy new year/i.test(message)
    && /\b(?:you|your)\b/i.test(message)
    && wordCount >= 48
    && wordCount <= 90
    && !firstPerson.test(message)
    && !resumeStyle.test(message);
}

export function parseGreeting(raw: string, profile: ProfileInput): GreetingDraft {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return fallbackGreeting(profile);
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<GreetingDraft>;
    const message = String(parsed.message || "").replace(/\s+/g, " ").trim();
    if (!isHeartfeltNewYearCard(message, profile)) return fallbackGreeting(profile);
    const knownFacts = profile.resumeFacts || [];
    const usedFacts = factsMentionedIn(message, knownFacts);
    if (knownFacts.length > 0 && usedFacts.length === 0) return fallbackGreeting(profile);
    return {
      recipientName: String(parsed.recipientName || profile.fullName).slice(0, 160),
      headline: String(parsed.headline || profile.headline).slice(0, 300),
      company: String(parsed.company || profile.company).slice(0, 160),
      occasion: "Happy New Year",
      message: message.slice(0, 700),
      signature: cardSignature(profile.senderName).slice(0, 160),
      accent: String(parsed.accent || "golden new year sparks").slice(0, 160),
      imagePrompt: String(parsed.imagePrompt || "warm New Year greeting-card background, abstract festive details, no text, no logos").slice(0, 300),
      usedFacts
    };
  } catch {
    return fallbackGreeting(profile);
  }
}
