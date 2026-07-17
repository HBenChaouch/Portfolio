import { spawnSync } from "node:child_process";

const executable = process.env.GITHUB_ACTIONS === "true" ? "pwsh" : "powershell.exe";
const result = spawnSync(
  executable,
  ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/check-workbook.ps1"],
  { stdio: "inherit" },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
