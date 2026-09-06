import { toPng } from "html-to-image";
import type { GreetingDraft, ModelState, ProfileInput } from "../shared/contracts.js";
import { unusedResumeFacts } from "../shared/rewrite-facts.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $("profile-form") as HTMLFormElement;
const status = $("model-status");
const setupCard = $("setup-card");
const formMessage = $("form-message");
const generateButton = $("generate-button") as HTMLButtonElement;
const downloadButton = $("download-button") as HTMLButtonElement;
const chooseButton = $("choose-button") as HTMLButtonElement;
const exportButton = $("download-card") as HTMLButtonElement;
const copyButton = $("copy-text") as HTMLButtonElement;
const rewriteButton = $("rewrite-card") as HTMLButtonElement;
const card = $("greeting-card");
const importPdfButton = $("import-pdf") as HTMLButtonElement;
const pdfStatus = $("pdf-status");

let modelReady = false;
let lastGreeting: GreetingDraft | undefined;
let automaticInstallStarted = false;
let importedResumeFacts: string[] = [];
let usedResumeFacts: string[] = [];
const SENDER_NAME_STORAGE_KEY = "gemma-greetings.sender-name";
const senderNameInput = $("senderName") as HTMLInputElement;

function setStatus(state: ModelState): void {
  status.className = "model-status";
  if (state.status === "ready") {
    modelReady = true;
    status.classList.add("ready");
    status.textContent = "Gemma 3 is ready — private and local";
    setupCard.classList.add("hidden");
    generateButton.disabled = false;
    updateRewriteButton();
    return;
  }
  modelReady = false;
  generateButton.disabled = true;
  updateRewriteButton();
  if (state.status === "downloading") {
    status.classList.add("busy");
    status.textContent = state.message;
    setupCard.classList.remove("hidden");
    downloadButton.disabled = true;
    chooseButton.disabled = true;
    downloadButton.textContent = state.progress > 0 ? `Installing… ${state.progress}%` : "Installing…";
    return;
  }
  setupCard.classList.remove("hidden");
  downloadButton.disabled = false;
  chooseButton.disabled = false;
  downloadButton.textContent = "Install local Gemma 3";
  if (state.status === "error") {
    status.classList.add("error");
    status.textContent = state.message;
  } else {
    status.textContent = "Gemma 3 needs a one-time local installation";
  }
}

function value(id: string): string { return ($(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value; }

function restoreSenderName(): void {
  const savedName = window.localStorage.getItem(SENDER_NAME_STORAGE_KEY);
  if (savedName && !senderNameInput.value.trim()) senderNameInput.value = savedName;
}

function saveSenderName(): void {
  const senderName = senderNameInput.value.trim();
  if (senderName) window.localStorage.setItem(SENDER_NAME_STORAGE_KEY, senderName);
  else window.localStorage.removeItem(SENDER_NAME_STORAGE_KEY);
}

function alternateResumeFacts(): string[] {
  return unusedResumeFacts(importedResumeFacts, usedResumeFacts);
}

function updateRewriteButton(): void {
  const alternatives = alternateResumeFacts();
  rewriteButton.disabled = !modelReady || !lastGreeting || alternatives.length === 0;
  rewriteButton.title = alternatives.length > 0
    ? "Create another card using a different verified detail from this PDF"
    : "Import a profile PDF with at least one unused verified detail to rewrite the card";
}

function clearCardState(): void {
  lastGreeting = undefined;
  usedResumeFacts = [];
  exportButton.disabled = true;
  copyButton.disabled = true;
  updateRewriteButton();
}

function profileFromForm(): ProfileInput {
  return {
    fullName: value("fullName"),
    headline: value("headline"),
    company: value("company"),
    location: value("location"),
    profileNotes: value("profileNotes"),
    resumeFacts: importedResumeFacts,
    occasion: value("occasion"),
    relationship: value("relationship"),
    senderName: value("senderName"),
    tone: value("tone") as ProfileInput["tone"],
    theme: value("theme") as ProfileInput["theme"]
  };
}

function renderCard(greeting: GreetingDraft, theme: string): void {
  $("card-occasion").textContent = greeting.occasion;
  $("card-name").textContent = greeting.recipientName;
  $("card-message").textContent = greeting.message;
  const signature = $("card-signature");
  signature.textContent = greeting.signature;
  signature.classList.toggle("hidden", !greeting.signature.trim());
  card.className = `greeting-card theme-${theme}`;
  card.classList.toggle("long-message", greeting.message.length > 360);
  exportButton.disabled = false;
  copyButton.disabled = false;
  updateRewriteButton();
}

async function installModel(): Promise<void> {
  formMessage.textContent = "";
  setStatus({ status: "downloading", progress: 0, message: "Starting local Gemma 3 installation…" });
  const state = await window.gemma.downloadModel();
  setStatus(state);
}

async function importProfilePdf(): Promise<void> {
  const original = importPdfButton.textContent;
  importPdfButton.disabled = true;
  importPdfButton.textContent = "Reading PDF…";
  pdfStatus.className = "pdf-status";
  pdfStatus.textContent = "Extracting text on this computer…";
  formMessage.textContent = "";
  try {
    const imported = await window.gemma.importProfilePdf();
    if (!imported) {
      pdfStatus.textContent = "No PDF selected";
      return;
    }
    importedResumeFacts = imported.profile.resumeFacts || [];
    clearCardState();
    const fields: Record<string, string | undefined> = {
      fullName: imported.profile.fullName,
      headline: imported.profile.headline,
      company: imported.profile.company,
      location: imported.profile.location,
      profileNotes: imported.profile.profileNotes
    };
    Object.entries(fields).forEach(([id, importedValue]) => {
      if (importedValue) ($(id) as HTMLInputElement | HTMLTextAreaElement).value = importedValue;
    });
    pdfStatus.classList.add("ready");
    pdfStatus.textContent = `${imported.fileName} read locally — ${imported.pageCount} page${imported.pageCount === 1 ? "" : "s"}; ${importedResumeFacts.length} résumé highlight${importedResumeFacts.length === 1 ? "" : "s"} selected`;
    formMessage.textContent = importedResumeFacts.length > 0
      ? `The app found ${importedResumeFacts.length} résumé highlights. Add an occasion, review the fields, then create a card that mentions one of them.`
      : "Profile details were added from the PDF. Add an occasion, review the fields, then create the card.";
  } catch (error) {
    pdfStatus.classList.add("error");
    pdfStatus.textContent = "Could not read this PDF";
    formMessage.textContent = error instanceof Error ? error.message : "Unable to read the selected PDF.";
  } finally {
    importPdfButton.disabled = false;
    importPdfButton.textContent = original;
  }
}

function useSample(): void {
  const sample: Record<string, string> = {
    fullName: "Avery Patel",
    headline: "Design leader focused on accessible technology",
    company: "Northstar Studio",
    location: "Chicago, Illinois",
    profileNotes: "Recently completed a major accessibility initiative and mentors early-career designers. Enjoys building thoughtful, practical products.",
    occasion: "Happy New Year",
    relationship: "Former colleague",
    senderName: "Alex"
  };
  const savedSenderName = senderNameInput.value.trim();
  Object.entries(sample).forEach(([id, text]) => {
    if (id !== "senderName" || !savedSenderName) ($(id) as HTMLInputElement | HTMLTextAreaElement).value = text;
  });
  ($("tone") as HTMLSelectElement).value = "warm";
  importedResumeFacts = ["Completed a major accessibility initiative", "Mentors early-career designers"];
  clearCardState();
  ($("theme") as HTMLSelectElement).value = "confetti";
  formMessage.textContent = "Sample New Year details added. Choose “Create greeting card” when Gemma 3 is ready.";
}

async function createCard(rewrite = false): Promise<void> {
  if (!modelReady) {
    formMessage.textContent = "Install the local Gemma 3 model first.";
    return;
  }
  if (!rewrite) usedResumeFacts = [];
  const factsForThisVersion = (rewrite ? alternateResumeFacts() : importedResumeFacts).slice(0, 1);
  if (rewrite && factsForThisVersion.length === 0) {
    formMessage.textContent = "No unused verified PDF detail remains for another version. Import a different PDF or edit the profile details to create a new card.";
    updateRewriteButton();
    return;
  }

  generateButton.disabled = true;
  rewriteButton.disabled = true;
  generateButton.textContent = rewrite ? "Writing another version…" : "Writing your card…";
  formMessage.textContent = rewrite
    ? "Creating a new card using a different verified detail from the PDF…"
    : "";
  try {
    const profile = profileFromForm();
    profile.resumeFacts = factsForThisVersion;
    const greeting = await window.gemma.generateGreeting(profile);
    lastGreeting = greeting;
    usedResumeFacts = [...usedResumeFacts, ...greeting.usedFacts];
    renderCard(greeting, profile.theme);
    formMessage.textContent = greeting.usedFacts.length > 0
      ? `${rewrite ? "New version" : "Greeting card"} created locally using: ${greeting.usedFacts.slice(0, 2).join("; ")}`
      : "Greeting card created locally. Review and edit by changing details and generating again.";
  } catch (error) {
    formMessage.textContent = error instanceof Error ? error.message : "The local model could not create the card.";
  } finally {
    generateButton.disabled = !modelReady;
    generateButton.textContent = "Create greeting card";
    updateRewriteButton();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void createCard(false);
});

downloadButton.addEventListener("click", () => void installModel());
chooseButton.addEventListener("click", async () => setStatus(await window.gemma.chooseModel()));
$("sample-button").addEventListener("click", useSample);
importPdfButton.addEventListener("click", () => void importProfilePdf());
rewriteButton.addEventListener("click", () => void createCard(true));
senderNameInput.addEventListener("input", saveSenderName);
restoreSenderName();

exportButton.addEventListener("click", async () => {
  if (!lastGreeting) return;
  const original = exportButton.textContent;
  exportButton.disabled = true;
  exportButton.textContent = "Saving…";
  try {
    const width = Math.ceil(card.getBoundingClientRect().width);
    const height = Math.ceil(card.getBoundingClientRect().height);
    const dataUrl = await toPng(card, { width, height, pixelRatio: 2, cacheBust: true });
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `${lastGreeting.recipientName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "greeting-card"}.png`;
    anchor.click();
  } catch (error) {
    formMessage.textContent = error instanceof Error ? error.message : "Unable to save the card image.";
  } finally {
    exportButton.disabled = false;
    exportButton.textContent = original;
  }
});

copyButton.addEventListener("click", async () => {
  if (!lastGreeting) return;
  await navigator.clipboard.writeText(lastGreeting.signature ? `${lastGreeting.message}\n\n${lastGreeting.signature}` : lastGreeting.message);
  const original = copyButton.textContent;
  copyButton.textContent = "Copied";
  setTimeout(() => { copyButton.textContent = original; }, 1400);
});

window.gemma.onModelProgress(setStatus);
window.gemma.getModelState().then((initialState) => {
  setStatus(initialState);
  if (initialState.status === "missing" && !automaticInstallStarted) {
    automaticInstallStarted = true;
    void installModel();
  }
}).catch(() => setStatus({ status: "error", message: "Unable to check the local model." }));
