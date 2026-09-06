export type Tone = "warm" | "professional" | "celebratory" | "friendly" | "grateful";

export type CardTheme = "sunrise" | "midnight" | "garden" | "confetti" | "classic";

export interface ProfileInput {
  fullName: string;
  headline: string;
  company: string;
  location: string;
  profileNotes: string;
  resumeFacts?: string[];
  occasion: string;
  relationship: string;
  senderName: string;
  tone: Tone;
  theme: CardTheme;
}

export interface PdfProfileImport {
  fileName: string;
  pageCount: number;
  extractedCharacters: number;
  profile: Partial<Pick<ProfileInput, "fullName" | "headline" | "company" | "location" | "profileNotes" | "resumeFacts">>;
}

export interface GreetingDraft {
  recipientName: string;
  headline: string;
  company: string;
  occasion: string;
  message: string;
  signature: string;
  accent: string;
  imagePrompt: string;
  usedFacts: string[];
}

export type ModelState =
  | { status: "ready"; path: string; source: "bundled" | "downloaded" | "selected" }
  | { status: "missing"; path?: string; message: string }
  | { status: "downloading"; progress: number; message: string }
  | { status: "error"; message: string };

export interface AppApi {
  getModelState: () => Promise<ModelState>;
  downloadModel: () => Promise<ModelState>;
  chooseModel: () => Promise<ModelState>;
  importProfilePdf: () => Promise<PdfProfileImport | undefined>;
  generateGreeting: (profile: ProfileInput) => Promise<GreetingDraft>;
  onModelProgress: (callback: (state: ModelState) => void) => () => void;
}

declare global {
  interface Window {
    gemma: AppApi;
  }
}
