import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const dist = new URL("../dist/", import.meta.url);
await rm(dist, { recursive: true, force: true });
await mkdir(new URL("main/", dist), { recursive: true });
await mkdir(new URL("preload/", dist), { recursive: true });
await mkdir(new URL("renderer/", dist), { recursive: true });

const common = {
  bundle: true,
  platform: "node",
  target: "node20",
  sourcemap: false,
  minify: false,
  external: ["electron", "node-llama-cpp"]
};

await build({
  ...common,
  entryPoints: ["src/main/index.ts"],
  outfile: "dist/main/index.cjs",
  format: "cjs"
});

await build({
  ...common,
  entryPoints: ["src/preload/index.ts"],
  outfile: "dist/preload/index.cjs",
  format: "cjs"
});

await build({
  bundle: true,
  platform: "browser",
  target: "es2022",
  entryPoints: ["src/renderer/index.ts"],
  outfile: "dist/renderer/index.js",
  format: "esm",
  sourcemap: false,
  minify: true
});

await cp("src/renderer/index.html", "dist/renderer/index.html");
await cp("src/renderer/styles.css", "dist/renderer/styles.css");
console.log("Built Electron application into dist/.");
