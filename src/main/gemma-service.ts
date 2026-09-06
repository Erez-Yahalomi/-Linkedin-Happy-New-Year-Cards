import { app, BrowserWindow, dialog } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, promises as fs } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { GreetingDraft, ModelState, ProfileInput } from "../shared/contracts.js";
import { parseGreeting as parseNewYearGreeting } from "../shared/new-year-card.js";

const MODEL_FILE = "gemma-3-1b-it-Q4_K_M.gguf";
const MODEL_URL = `https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF/resolve/main/${MODEL_FILE}?download=true`;
const MIN_MODEL_BYTES = 700 * 1024 * 1024;
const MAX_PROFILE_CHARS = 12_000;
const SERVER_READY_TIMEOUT_MS = 75_000;

type LocalServer = {
  modelPath: string;
  port: number;
  process: ChildProcess;
  log: string[];
};

let selectedModelPath: string | undefined;
let activeDownload: Promise<ModelState> | undefined;
let activeServer: LocalServer | undefined;

function bundledModelPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "resources", "models", MODEL_FILE)
    : join(app.getAppPath(), "resources", "models", MODEL_FILE);
}

function downloadedModelPath(): string {
  return join(app.getPath("userData"), "models", MODEL_FILE);
}

function llamaRuntimeDirectory(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "resources", "llama-win-x64")
    : join(app.getAppPath(), "resources", "llama-win-x64");
}

function llamaServerPath(): string {
  return join(llamaRuntimeDirectory(), "llama-server.exe");
}

function emit(state: ModelState): void {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send("model:progress", state);
}

async function isUsableModel(path: string | undefined): Promise<boolean> {
  if (!path || !existsSync(path)) return false;
  try {
    const stat = await fs.stat(path);
    if (stat.size < MIN_MODEL_BYTES) return false;
    const file = await fs.open(path, "r");
    try {
      const header = Buffer.alloc(4);
      await file.read(header, 0, 4, 0);
      return header.toString("utf8") === "GGUF";
    } finally {
      await file.close();
    }
  } catch {
    return false;
  }
}

function hasLlamaRuntime(): boolean {
  const runtime = llamaRuntimeDirectory();
  return existsSync(join(runtime, "llama-server.exe")) && existsSync(join(runtime, "llama-server-impl.dll")) && existsSync(join(runtime, "llama.dll"));
}

async function resolveModel(): Promise<{ path: string; source: "bundled" | "downloaded" | "selected" } | undefined> {
  if (await isUsableModel(selectedModelPath)) return { path: selectedModelPath!, source: "selected" };
  const bundled = bundledModelPath();
  if (await isUsableModel(bundled)) return { path: bundled, source: "bundled" };
  const downloaded = downloadedModelPath();
  if (await isUsableModel(downloaded)) return { path: downloaded, source: "downloaded" };
  return undefined;
}

export async function getModelState(): Promise<ModelState> {
  if (!hasLlamaRuntime()) return { status: "error", message: "The local Gemma runtime is missing. Please reinstall the application." };
  const resolved = await resolveModel();
  return resolved
    ? { status: "ready", path: resolved.path, source: resolved.source }
    : { status: "missing", message: "Gemma 3 is not installed yet." };
}

export async function chooseModelFile(): Promise<ModelState> {
  const result = await dialog.showOpenDialog({
    title: "Choose a Gemma 3 GGUF model",
    properties: ["openFile"],
    filters: [{ name: "GGUF model", extensions: ["gguf"] }]
  });
  if (result.canceled || !result.filePaths[0]) return getModelState();
  selectedModelPath = result.filePaths[0];
  await stopServer();
  const state = await getModelState();
  if (state.status !== "ready") return { status: "error", message: "That file is not a usable Gemma 3 GGUF model." };
  emit(state);
  return state;
}

export async function downloadModel(): Promise<ModelState> {
  if (activeDownload) return activeDownload;
  activeDownload = (async () => {
    const destination = downloadedModelPath();
    const partial = `${destination}.partial`;
    await fs.mkdir(dirname(destination), { recursive: true });
    await fs.rm(partial, { force: true });
    try {
      emit({ status: "downloading", progress: 0, message: "Downloading local Gemma 3 model…" });
      const response = await fetch(MODEL_URL, { redirect: "follow" });
      if (!response.ok || !response.body) throw new Error(`Model download failed (${response.status}).`);
      const contentLength = Number(response.headers.get("content-length") || 0);
      let downloaded = 0;
      const source = Readable.fromWeb(response.body as unknown as import("stream/web").ReadableStream);
      source.on("data", (chunk: Buffer) => {
        downloaded += chunk.length;
        const progress = contentLength > 0 ? Math.min(99, Math.round((downloaded / contentLength) * 100)) : 0;
        emit({ status: "downloading", progress, message: contentLength > 0 ? `Downloading Gemma 3… ${progress}%` : "Downloading Gemma 3…" });
      });
      await pipeline(source, createWriteStream(partial));
      await fs.rename(partial, destination);
      if (!(await isUsableModel(destination))) throw new Error("The downloaded file is not a valid Gemma 3 GGUF model.");
      await stopServer();
      const state: ModelState = { status: "ready", path: destination, source: "downloaded" };
      emit(state);
      return state;
    } catch (error) {
      await fs.rm(partial, { force: true });
      const state: ModelState = { status: "error", message: error instanceof Error ? error.message : "Unable to download Gemma 3." };
      emit(state);
      return state;
    } finally {
      activeDownload = undefined;
    }
  })();
  return activeDownload;
}

function appendLog(server: LocalServer, chunk: Buffer): void {
  const lines = chunk.toString("utf8").split(/\r?\n/).filter(Boolean);
  server.log.push(...lines);
  if (server.log.length > 30) server.log.splice(0, server.log.length - 30);
}

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : undefined;
      server.close((error) => error ? reject(error) : port ? resolve(port) : reject(new Error("Could not reserve a local port.")));
    });
  });
}

async function waitForServer(server: LocalServer): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < SERVER_READY_TIMEOUT_MS) {
    if (server.process.exitCode !== null) {
      throw new Error(`The bundled Gemma runtime stopped before it was ready. ${server.log.slice(-4).join(" ")}`.trim());
    }
    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/v1/models`);
      if (response.ok) return;
    } catch { /* keep waiting while the local model loads */ }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error("The local Gemma runtime took too long to start. Close other memory-intensive applications and try again.");
}

async function startServer(modelPath: string): Promise<LocalServer> {
  if (activeServer?.modelPath === modelPath && activeServer.process.exitCode === null) return activeServer;
  await stopServer();
  if (!hasLlamaRuntime()) throw new Error("The bundled local Gemma runtime is missing. Please reinstall the application.");

  const port = await getAvailablePort();
  const runtimeDirectory = llamaRuntimeDirectory();
  const process = spawn(llamaServerPath(), [
    "--model", modelPath,
    "--host", "127.0.0.1",
    "--port", String(port),
    "--ctx-size", "4096",
    "--parallel", "1",
    "--no-webui",
    "--no-warmup"
  ], {
    cwd: runtimeDirectory,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const server: LocalServer = { modelPath, port, process, log: [] };
  process.stdout?.on("data", (chunk: Buffer) => appendLog(server, chunk));
  process.stderr?.on("data", (chunk: Buffer) => appendLog(server, chunk));
  process.on("error", (error) => appendLog(server, Buffer.from(error.message)));
  activeServer = server;
  try {
    await waitForServer(server);
    return server;
  } catch (error) {
    await stopServer();
    throw error;
  }
}

async function stopServer(): Promise<void> {
  const server = activeServer;
  activeServer = undefined;
  if (!server || server.process.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      try { server.process.kill("SIGKILL"); } catch { /* ignore */ }
      resolve();
    }, 3_000);
    server.process.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    try { server.process.kill(); } catch { clearTimeout(timer); resolve(); }
  });
}

function validateProfile(value: ProfileInput): ProfileInput {
  const clean = (input: string, limit = 1_000) => String(input ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, limit);
  const profile: ProfileInput = {
    fullName: clean(value.fullName, 160),
    headline: clean(value.headline, 300),
    company: clean(value.company, 160),
    location: clean(value.location, 160),
    profileNotes: clean(value.profileNotes, MAX_PROFILE_CHARS),
    resumeFacts: Array.isArray(value.resumeFacts)
      ? value.resumeFacts.map((fact) => clean(fact, 320)).filter((fact) => fact.length >= 12).slice(0, 6)
      : [],
    occasion: "Happy New Year",
    relationship: clean(value.relationship, 160),
    senderName: clean(value.senderName, 160),
    tone: value.tone,
    theme: value.theme
  };
  if (!profile.fullName) throw new Error("Add the recipient’s name or import a profile PDF.");
  if (!profile.occasion) throw new Error("Add an occasion.");
  return profile;
}

function greetingPrompt(profile: ProfileInput): string {
  const facts = profile.resumeFacts?.length
    ? profile.resumeFacts.map((fact, index) => `${index + 1}. ${fact}`).join("\n")
    : "None supplied";
  return `Write a warm, heartfelt Happy New Year greeting card addressed directly to the recipient. It is a personal card, not a résumé, CV, professional bio, recommendation, or career summary. Use only the supplied profile information. Do not invent achievements, dates, job titles, personal facts, or a relationship. Never mention LinkedIn. Return exactly one valid JSON object with these keys: recipientName, headline, company, occasion, message, signature, accent, imagePrompt, usedFacts.\n\nRequired card voice:\n- Start the message exactly with: "Dear ${firstName(profile.fullName)}, Happy New Year!"\n- Write 48–78 words as one warm, natural paragraph. Speak to the recipient using "you" and "your".\n- Offer sincere wishes for joy, warmth, inspiration, or meaningful possibilities in the year ahead.\n- If verified résumé facts are supplied, naturally weave in one or two facts as something to celebrate. Make it personal and appreciative; do not copy facts as a list or write a career summary.\n- Never write from the recipient’s first-person point of view. Do not use the words "I", "me", "my", "we", "our", or "us" anywhere in the message.
- Follow this simple flow: New Year wish → a warm sentence celebrating one real contribution → kind wishes for the year ahead.\n- Do not use résumé/CV language such as "experience", "qualifications", "skills", "responsibilities", "profile", or "career summary".\n- usedFacts: an array containing the exact supplied résumé fact or facts that are reflected in the message.\n- do not use any claim that is not in the supplied facts or profile information.\n- signature: use the sender name if supplied; otherwise "With warm wishes".\n- accent: 2–5 words describing a celebratory New Year decorative motif, not a real person or trademark.\n- imagePrompt: a short abstract New Year greeting-card background description, no text and no logos.\n\nExample of the desired voice (do not copy names or facts):\n"Dear Maya, Happy New Year! May the months ahead bring you bright moments, renewed inspiration, and plenty of reasons to smile. The thoughtful way you helped bring an important project to life is something to celebrate. Wishing you warmth, joy, and wonderful possibilities throughout the year."\n\nRecipient information:\nName: ${profile.fullName}\nHeadline: ${profile.headline || "Not supplied"}\nCompany: ${profile.company || "Not supplied"}\nLocation: ${profile.location || "Not supplied"}\nVerified résumé facts:\n${facts}\nAdditional profile notes: ${profile.profileNotes || "Not supplied"}\nRelationship to sender: ${profile.relationship || "Not supplied"}\nRequested warmth: ${profile.tone}\nRequested design theme: ${profile.theme}\nSender: ${profile.senderName || "Not supplied"}`;
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

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

function celebrateFact(fact: string): string {
  if (/^developing\s+/i.test(fact)) {
    return `The care and expertise behind your work ${fact.replace(/^developing\s+/i, "developing ")} are truly worth celebrating.`;
  }
  if (/^engineering manager at\s+/i.test(fact)) {
    return `The leadership you bring as ${fact} is truly worth celebrating.`;
  }
  if (/^backend team lead at\s+/i.test(fact)) {
    return `The leadership you brought as ${fact} is truly worth celebrating.`;
  }
  return `The dedication reflected in ${fact} is truly worth celebrating.`;
}

export function fallbackGreeting(profile: ProfileInput): GreetingDraft {
  const signature = profile.senderName || "With warm wishes";
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

function parseGreetingLegacy(raw: string, profile: ProfileInput): GreetingDraft {
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
      signature: String(parsed.signature || profile.senderName || "With warm wishes").slice(0, 160),
      accent: String(parsed.accent || "golden new year sparks").slice(0, 160),
      imagePrompt: String(parsed.imagePrompt || "warm New Year greeting-card background, abstract festive details, no text, no logos").slice(0, 300),
      usedFacts
    };
  } catch {
    return fallbackGreeting(profile);
  }
}

export async function generateGreeting(input: ProfileInput): Promise<GreetingDraft> {
  const profile = validateProfile(input);
  const resolved = await resolveModel();
  if (!resolved) throw new Error("Gemma 3 is not installed yet. Keep the app open while its one-time download finishes.");
  const server = await startServer(resolved.path);
  const nativePrompt = `<start_of_turn>user\n${greetingPrompt(profile)}<end_of_turn>\n<start_of_turn>model\n`;
  const response = await fetch(`http://127.0.0.1:${server.port}/completion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: nativePrompt,
      n_predict: 500,
      temperature: 0.2,
      stop: ["<end_of_turn>"]
    })
  });
  if (!response.ok) {
    const details = (await response.text()).slice(0, 500);
    throw new Error(`The local Gemma runtime could not create the card (${response.status}). ${details}`);
  }
  const payload = await response.json() as { content?: string };
  const content = payload.content;
  if (!content) throw new Error("The local Gemma runtime returned an empty greeting. Please try again.");
  return parseNewYearGreeting(content, profile);
}

export async function disposeModel(): Promise<void> {
  await stopServer();
}
