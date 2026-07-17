import { copyFile, mkdir } from "node:fs/promises";

const source = new URL("../dist/index.html", import.meta.url);
const staticRoutes = [
  "cases/sidetrade-valuation",
  "cases/sidetrade-valuation/analysis",
];

await copyFile(source, new URL("../dist/404.html", import.meta.url));

for (const route of staticRoutes) {
  const directory = new URL(`../dist/${route}/`, import.meta.url);
  await mkdir(directory, { recursive: true });
  await copyFile(source, new URL("index.html", directory));
}

console.log("SPA fallback and direct Sidetrade route entries mirror dist/index.html");
