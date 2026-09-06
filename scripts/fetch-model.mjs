import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const fileName = "gemma-3-1b-it-Q4_K_M.gguf";
const url = `https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF/resolve/main/${fileName}?download=true`;
const destination = resolve("resources", "models", fileName);
const partial = `${destination}.partial`;
const minBytes = 700 * 1024 * 1024;

async function verify(path) {
  if (!existsSync(path)) return false;
  const info = await stat(path);
  if (info.size < minBytes) return false;
  const file = await import("node:fs/promises").then(({ open }) => open(path, "r"));
  try {
    const header = Buffer.alloc(4);
    await file.read(header, 0, 4, 0);
    return header.toString("utf8") === "GGUF";
  } finally {
    await file.close();
  }
}

if (await verify(destination)) {
  console.log(`Model already present: ${destination}`);
  process.exit(0);
}

await mkdir(dirname(destination), { recursive: true });
await rm(partial, { force: true });
console.log("Downloading Gemma 3 1B Q4_K_M model (about 806 MB)…");
const response = await fetch(url, { redirect: "follow" });
if (!response.ok || !response.body) throw new Error(`Download failed: HTTP ${response.status}`);
const total = Number(response.headers.get("content-length") || 0);
let received = 0;
const source = Readable.fromWeb(response.body);
source.on("data", (chunk) => {
  received += chunk.length;
  if (total) process.stdout.write(`\r${Math.min(99, Math.round((received / total) * 100))}% downloaded`);
});
await pipeline(source, createWriteStream(partial));
process.stdout.write("\r100% downloaded\n");
await rename(partial, destination);
if (!(await verify(destination))) throw new Error("Downloaded model did not pass the GGUF integrity check.");
console.log(`Saved verified model to ${destination}`);
