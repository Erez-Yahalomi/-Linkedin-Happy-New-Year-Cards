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

/**
 * Selects card facts in source priority: About/Summary, newest role, then older résumé content as a fallback.
 */
export function extractPrioritizedResumeFacts(lines: string[], fullName?: string, headline?: string): string[] {
  const selected: string[] = [];
  const summaryIndex = lines.findIndex((line) => /^(?:about|about me|summary)$/i.test(line));
  const experienceIndex = lines.findIndex((line) => /^experience$/i.test(line));

  if (summaryIndex >= 0) {
    const summaryEnd = experienceIndex > summaryIndex ? experienceIndex : findSectionEnd(lines, summaryIndex);
    const summaryFacts = lines.slice(summaryIndex + 1, summaryEnd)
      .map((line) => candidateFact(line, fullName))
      .filter((line): line is string => Boolean(line));
    addUniqueFacts(selected, summaryFacts);
  }

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

  if (selected.length < 2) {
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
    addUniqueFacts(selected, fallback);
  }
  return selected;
}
