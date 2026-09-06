function normalizeFact(fact: string): string {
  return fact.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function unusedResumeFacts(allFacts: string[], usedFacts: string[]): string[] {
  const used = new Set(usedFacts.map(normalizeFact));
  return allFacts.filter((fact) => !used.has(normalizeFact(fact)));
}
