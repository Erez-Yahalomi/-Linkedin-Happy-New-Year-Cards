import { dialog } from "electron";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename } from "node:path";
import type { PdfProfileImport, ProfileInput } from "../shared/contracts.js";
import { extractPrioritizedResumeFacts } from "../shared/pdf-fact-selection.js";

const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 12_000;
const require = createRequire(__filename);
const pdfParse = require("pdf-parse-legacy/lib/pdf-parse.js") as (data: Buffer) => Promise<{ numpages: number; text: string }>;
const PDFJS = require("pdf-parse-legacy/lib/pdf.js/v1.10.100/build/pdf.js") as {
  disableWorker: boolean;
  getDocument(data: Buffer): Promise<{
    getPage(pageNumber: number): Promise<{ view: number[]; getTextContent(options: { normalizeWhitespace: boolean; disableCombineTextItems: boolean }): Promise<{ items: Array<{ str: string; transform: number[]; height?: number }> }> }>;
    destroy(): Promise<void> | void;
  }>;
};
PDFJS.disableWorker = true;

function clean(value: string, max = 600): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function looksLikeHeading(value: string): boolean {
  return value.length >= 4 && value.length <= 180 && !/[.!?]$/.test(value) && /[A-Za-z]/.test(value);
}

function isNameCandidate(value: string): boolean {
  const words = value.split(/\s+/).filter(Boolean);
  const excluded = /linkedin|resume|curriculum|profile|experience|education|contact|top skills|skills|languages|certifications|publications|summary|page \d+|complex systems|team leadership|performance servers/i;
  return words.length >= 2 && words.length <= 4 && value.length < 80 && !excluded.test(value)
    && words.every((word) => /^[A-Z][A-Za-z'’-]*$/.test(word));
}

async function findProminentFirstPageName(data: Buffer): Promise<string | undefined> {
  const document = await PDFJS.getDocument(data);
  try {
    const page = await document.getPage(1);
    const pageHeight = page.view[3] || 1;
    const items = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
    const candidates = items.items.map((item) => {
      const text = clean(String(item.str), 80);
      const x = Number(item.transform?.[4] || 0);
      const y = Number(item.transform?.[5] || 0);
      const fontHeight = Number(item.height || Math.abs(item.transform?.[0] || 0));
      return { text, x, y, fontHeight };
    }).filter((item) => isNameCandidate(item.text) && item.x >= 170 && item.y >= pageHeight * 0.78 && item.fontHeight >= 18)
      .sort((a, b) => b.fontHeight - a.fontHeight || b.y - a.y || b.x - a.x);
    return candidates[0]?.text;
  } finally {
    await document.destroy();
  }
}

function findName(lines: string[]): string | undefined {
  const excluded = /linkedin|resume|curriculum|profile|experience|education|contact|top skills|skills|languages|certifications|publications|summary|page \d+|complex systems|team leadership|performance servers/i;
  const emailHandles = lines
    .filter((line) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(line))
    .map((line) => line.split("@")[0].toLowerCase().replace(/[^a-z]/g, ""));
  const candidates = lines.slice(0, 100).map((line, index) => ({ line, index })).filter(({ line }) => {
    const words = line.split(/\s+/).filter(Boolean);
    return words.length >= 2 && words.length <= 4 && line.length < 80 && !excluded.test(line)
      && words.every((word) => /^[A-Z][A-Za-z'’-]*$/.test(word));
  });
  const ranked = candidates.map((candidate) => {
    const compact = candidate.line.toLowerCase().replace(/[^a-z]/g, "");
    const reverseCompact = candidate.line.split(/\s+/).reverse().join("").toLowerCase().replace(/[^a-z]/g, "");
    const emailMatch = emailHandles.some((handle) => handle === compact || handle === reverseCompact) ? 20 : 0;
    const followingContext = lines.slice(candidate.index + 1, candidate.index + 3).join(" ");
    const profileContext = /\b(?:manager|engineer|developer|director|lead|founder|consultant|designer|analyst|specialist)\b/i.test(followingContext) ? 4 : 0;
    return { ...candidate, score: emailMatch + profileContext - candidate.index / 1000 };
  }).sort((a, b) => b.score - a.score);
  return ranked[0]?.line;
}

function findHeadline(lines: string[], name?: string): string | undefined {
  const start = name ? Math.max(0, lines.indexOf(name) + 1) : 0;
  for (const line of lines.slice(start, start + 10)) {
    if (looksLikeHeading(line) && line.length > 12 && !/^(experience|education|skills|contact|about|summary)$/i.test(line)) return line;
  }
  return undefined;
}

function extractCompany(text: string): string | undefined {
  const match = text.match(/(?:current (?:role|position|company)|company|organization)\s*[:\-]\s*([^\n]{2,100})/i);
  return match ? clean(match[1], 160) : undefined;
}

function extractLocation(text: string): string | undefined {
  const match = text.match(/(?:location|based in|located in)\s*[:\-]?\s*([^\n]{2,100})/i);
  return match ? clean(match[1], 160) : undefined;
}

function normalizeText(text: string): string {
  return text
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const ACTION_PATTERN = /\b(led|built|launched|managed|created|developed|developing|designed|delivered|improved|grew|increased|reduced|founded|co-founded|mentored|advised|awarded|recognized|published|implemented|directed|transformed|achieved|responsible for)\b/i;
const ROLE_PATTERN = /\b(engineering manager|team lead|software engineer|software developer|scrum master|architect|director|product manager|developer)\b/i;
const SKILLS_PATTERN = /\b(java|kotlin|c\+\+|reactive programming|microservices|automation|complex systems|databases)\b/i;
const DATE_ONLY_PATTERN = /^(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\s*-\s*(?:(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}|present)\s*(?:\([^)]*\))?$/i;
const SECTION_HEADING_PATTERN = /^(?:experience|education|skills|top skills|languages|contact|certifications|publications|projects|volunteering|interests|page \d+ of \d+)$/i;

function candidateFact(line: string, fullName?: string): string | undefined {
  const fact = line.replace(/^[•\-*–—\d.()\s]+/, "").trim();
  if (fact.length < 12 || fact.length > 320 || fact === fullName || SECTION_HEADING_PATTERN.test(fact) || DATE_ONLY_PATTERN.test(fact)) return undefined;
  return fact;
}

function addUniqueFacts(target: string[], candidates: Array<string | undefined>): void {
  for (const candidate of candidates) {
    if (!candidate || target.some((fact) => fact.toLocaleLowerCase() === candidate.toLocaleLowerCase())) continue;
    target.push(candidate);
    if (target.length === 6) return;
  }
}

function findSectionEnd(lines: string[], start: number): number {
  for (let index = start + 1; index < lines.length; index += 1) {
    if (SECTION_HEADING_PATTERN.test(lines[index])) return index;
  }
  return lines.length;
}

export function extractResumeFacts(lines: string[], fullName?: string, headline?: string): string[] {
  const selected: string[] = [];
  const summaryIndex = lines.findIndex((line) => /^(?:about|about me|summary)$/i.test(line));
  const experienceIndex = lines.findIndex((line) => /^experience$/i.test(line));

  // First prioritize the recipient's own About/Summary text when it exists.
  if (summaryIndex >= 0) {
    const summaryEnd = experienceIndex > summaryIndex ? experienceIndex : findSectionEnd(lines, summaryIndex);
    const summaryFacts = lines.slice(summaryIndex + 1, summaryEnd)
      .map((line) => candidateFact(line, fullName))
      .filter((line): line is string => Boolean(line));
    addUniqueFacts(selected, summaryFacts);
  }

  // Then prefer the current headline and the first meaningful description in Experience.
  if (headline && ROLE_PATTERN.test(headline)) addUniqueFacts(selected, [headline]);
  if (experienceIndex >= 0) {
    const experienceEnd = findSectionEnd(lines, experienceIndex);
    const experienceLines = lines.slice(experienceIndex + 1, experienceEnd);
    const currentRoleDateIndex = experienceLines.findIndex((line) => DATE_ONLY_PATTERN.test(line));
    if (currentRoleDateIndex >= 0) {
      const afterCurrentRoleDate = experienceLines.slice(currentRoleDateIndex + 1);
      const nextRoleDateIndex = afterCurrentRoleDate.findIndex((line) => DATE_ONLY_PATTERN.test(line));
      const currentRoleDescription = afterCurrentRoleDate.slice(0, nextRoleDateIndex >= 0 ? nextRoleDateIndex : 6)
        .map((line) => candidateFact(line, fullName))
        .filter((line): line is string => Boolean(line))
        .filter((line) => ACTION_PATTERN.test(line) || SKILLS_PATTERN.test(line));
      addUniqueFacts(selected, currentRoleDescription);
    }
  }

  // Use older or less prominent résumé details only when the preferred About and current-role sources provide fewer than two usable facts.
  const fallback = lines
    .map((line) => candidateFact(line, fullName))
    .filter((line): line is string => Boolean(line))
    .map((line) => ({
      line,
      score: (ACTION_PATTERN.test(line) ? 5 : 0) + (SKILLS_PATTERN.test(line) ? 4 : 0) + (ROLE_PATTERN.test(line) ? 2 : 0)
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ line }) => line);
  if (selected.length < 2) addUniqueFacts(selected, fallback);
  return selected;
}

export async function importProfilePdf(): Promise<PdfProfileImport | undefined> {
  const picked = await dialog.showOpenDialog({
    title: "Choose a profile PDF",
    properties: ["openFile"],
    filters: [{ name: "PDF documents", extensions: ["pdf"] }]
  });
  if (picked.canceled || !picked.filePaths[0]) return undefined;

  const filePath = picked.filePaths[0];
  const data = await readFile(filePath);
  if (data.byteLength > MAX_PDF_BYTES) throw new Error("Choose a PDF smaller than 15 MB.");
  if (data.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("The selected file is not a valid PDF document.");

  const result = await pdfParse(data);
  const extracted = normalizeText(result.text);
  if (extracted.length < 20) {
    throw new Error("No readable text was found in this PDF. Please use a text-based PDF or paste the profile details manually.");
  }
  const lines = extracted.split(/\n+/).map((line) => clean(line, 300)).filter(Boolean);
  const fullName = await findProminentFirstPageName(data) || findName(lines);
  const headline = findHeadline(lines, fullName);
  const resumeFacts = extractPrioritizedResumeFacts(lines, fullName, headline);
  const sourceExcerpt = extracted.slice(0, MAX_EXTRACTED_CHARS);
  const profileNotes = resumeFacts.length > 0
    ? `Resume highlights:\n${resumeFacts.map((fact) => `• ${fact}`).join("\n")}\n\nSource résumé text:\n${sourceExcerpt}`
    : sourceExcerpt;
  const profile: PdfProfileImport["profile"] = {
    fullName,
    headline,
    company: extractCompany(extracted),
    location: extractLocation(extracted),
    profileNotes,
    resumeFacts
  };
  return {
    fileName: basename(filePath),
    pageCount: result.numpages,
    extractedCharacters: extracted.length,
    profile
  };
}

export function mergeImportedProfile(original: ProfileInput, incoming: PdfProfileImport["profile"]): ProfileInput {
  return {
    ...original,
    fullName: incoming.fullName || original.fullName,
    headline: incoming.headline || original.headline,
    company: incoming.company || original.company,
    location: incoming.location || original.location,
    profileNotes: incoming.profileNotes || original.profileNotes
  };
}
