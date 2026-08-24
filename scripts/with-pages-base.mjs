// Runs an npm script with the production base path (base "/Portfolio/"),
// so local build/preview always match what GitHub Pages serves.
process.env.GITHUB_ACTIONS = "1";

const { spawnSync } = await import("node:child_process");

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Usage: node scripts/with-pages-base.mjs <npm-script>");
  process.exit(1);
}

const result = spawnSync("npm.cmd", ["run", command, ...args], {
  stdio: "inherit",
  shell: true,
});
process.exit(result.status ?? 1);
