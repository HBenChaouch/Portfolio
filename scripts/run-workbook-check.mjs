import { spawnSync } from "node:child_process";

const candidates = process.platform === "win32" ? ["pwsh", "powershell.exe"] : ["pwsh"];
let result;
for (const executable of candidates) {
  result = spawnSync(
    executable,
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/check-workbook.ps1"],
    { stdio: "inherit" },
  );
  if (result.error?.code === "ENOENT") continue;
  break;
}

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
