import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

const distRoot = path.resolve("dist");
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function availablePort() {
  const probe = createNetServer();
  await new Promise((resolve, reject) => probe.listen(0, "127.0.0.1", resolve).once("error", reject));
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue through the explicit cross-platform candidates.
    }
  }
  throw new Error("Chrome not found. Set CHROME_PATH to run the mandatory navigation browser test.");
}

function contentType(filename) {
  if (filename.endsWith(".css")) return "text/css; charset=utf-8";
  if (filename.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filename.endsWith(".json")) return "application/json; charset=utf-8";
  if (filename.endsWith(".svg")) return "image/svg+xml";
  if (filename.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "text/html; charset=utf-8";
}

const webServer = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const relativePath = pathname.replace(/^\/+/, "");
    let filename = path.resolve(distRoot, relativePath);
    if (!filename.startsWith(distRoot)) throw new Error("Path outside dist");

    try {
      if (!(await stat(filename)).isFile()) filename = path.join(distRoot, "index.html");
    } catch {
      filename = path.join(distRoot, "index.html");
    }

    response.writeHead(200, { "Content-Type": contentType(filename) });
    response.end(await readFile(filename));
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error.message);
  }
});

await new Promise((resolve, reject) => webServer.listen(0, "127.0.0.1", resolve).once("error", reject));
const webPort = webServer.address().port;
const cdpPort = await availablePort();
const profile = await mkdtemp(path.join(tmpdir(), "sidetrade-navigation-"));
const chromePath = await findChrome();
const chromeArguments = [
  ...(process.env.S12_HEADFUL === "1" ? [] : ["--headless=new"]),
  `--remote-debugging-port=${cdpPort}`,
  "--remote-allow-origins=*",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  `--user-data-dir=${profile}`,
  "about:blank",
];
const chrome = spawn(chromePath, chromeArguments, { stdio: "ignore" });
const base = `http://127.0.0.1:${webPort}/cases/sidetrade-valuation/analysis/`;

let socket;
let target;
let nextId = 0;
const pending = new Map();
const browserMessages = [];

async function waitForChrome() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
      if (response.ok) return;
    } catch {
      // Chrome is still starting.
    }
    await delay(50);
  }
  throw new Error("Chrome DevTools endpoint did not start");
}

function command(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function navigate(url) {
  await command("Page.navigate", { url });
  await waitFor(() => evaluate("document.readyState === 'complete'"), "page load");
}

async function waitFor(check, label, attempts = 120) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await check()) return;
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function anchorState(anchor) {
  return evaluate(`(() => {
    const target = document.querySelector('#${anchor}');
    return {
      active: document.querySelector('[aria-current="location"]')?.getAttribute('href'),
      documentHeight: document.documentElement.scrollHeight,
      hash: location.hash,
      lang: document.documentElement.lang,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      top: target?.getBoundingClientRect().top,
      url: location.href,
    };
  })()`);
}

async function waitForStableAnchor(anchor) {
  let previous;
  let stableSamples = 0;
  let current;
  await waitFor(async () => {
    current = await anchorState(anchor);
    const correctIdentity = current.hash === `#${anchor}` && current.active?.endsWith(`#${anchor}`);
    const stableGeometry = previous
      && Math.abs(current.top - previous.top) < 0.5
      && current.documentHeight === previous.documentHeight;
    stableSamples = correctIdentity && stableGeometry ? stableSamples + 1 : 0;
    previous = current;
    return stableSamples >= 2;
  }, `stable #${anchor}`);
  return current;
}

async function realPointerClick(elementExpression, label) {
  const point = await evaluate(`(async () => {
    const element = ${elementExpression};
    if (!element) return { error: 'missing' };
    element.scrollIntoView({ block: 'center', inline: 'center' });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    if (!(hit === element || element.contains(hit))) {
      return { error: 'hit-test', hit: hit?.textContent?.trim(), x, y };
    }
    window.__s12PointerDown = null;
    document.addEventListener('pointerdown', (event) => {
      window.__s12PointerDown = {
        trusted: event.isTrusted,
        text: event.target.textContent?.trim(),
      };
    }, { capture: true, once: true });
    return { x, y };
  })()`);
  assert(!point.error, `${label} cannot receive a pointer click: ${JSON.stringify(point)}`);

  await command("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await command("Input.dispatchMouseEvent", { button: "left", buttons: 1, clickCount: 1, type: "mousePressed", x: point.x, y: point.y });
  await command("Input.dispatchMouseEvent", { button: "left", buttons: 0, clickCount: 1, type: "mouseReleased", x: point.x, y: point.y });
  const pointerEvent = await evaluate("window.__s12PointerDown");
  assert(pointerEvent?.trusted, `${label} did not receive a trusted pointer event: ${JSON.stringify(pointerEvent)}`);
  return pointerEvent;
}

function visibleButton(label) {
  return `Array.from(document.querySelectorAll('button')).find((button) => {
    if (button.textContent.trim() !== ${JSON.stringify(label)}) return false;
    const rect = button.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || rect.bottom <= 0 || rect.top >= innerHeight) return false;
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit === button || button.contains(hit);
  })`;
}

try {
  await waitForChrome();
  target = await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`, { method: "PUT" }).then((response) => response.json());
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
      return;
    }
    if (message.method === "Runtime.exceptionThrown") browserMessages.push(`exception: ${message.params.exceptionDetails.text}`);
    if (message.method === "Log.entryAdded" && ["warning", "error"].includes(message.params.entry.level)) {
      browserMessages.push(`${message.params.entry.level}: ${message.params.entry.text}`);
    }
    if (message.method === "Runtime.consoleAPICalled" && ["warning", "error"].includes(message.params.type)) {
      browserMessages.push(`${message.params.type}: ${message.params.args.map((arg) => arg.value ?? arg.description).join(" ")}`);
    }
  });

  await command("Page.enable");
  await command("Runtime.enable");
  await command("Log.enable");
  await command("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

  await navigate(`${base}#dcf`);
  const direct = await waitForStableAnchor("dcf");
  assert(direct.top > 95 && direct.top < 130, `Direct DCF alignment mismatch: ${JSON.stringify(direct)}`);

  const tradingDistance = await evaluate("document.querySelector('#trading').getBoundingClientRect().top - 104");
  await command("Input.dispatchMouseEvent", { deltaX: 0, deltaY: tradingDistance, type: "mouseWheel", x: 1000, y: 500 });
  const scrolled = await waitForStableAnchor("trading");
  assert(scrolled.top > 95 && scrolled.top < 130, `Trading alignment mismatch: ${JSON.stringify(scrolled)}`);

  const footballPointer = await realPointerClick("document.querySelector('#sidetrade-section-navigation a[href$=\"#football\"]')", "Football field");
  const footballFr = await waitForStableAnchor("football");
  assert(footballFr.top > 95 && footballFr.top < 130, `Football FR alignment mismatch: ${JSON.stringify(footballFr)}`);

  const desktopEnPointer = await realPointerClick(visibleButton("EN"), "desktop EN");
  await delay(700);
  const footballEn700 = await anchorState("football");
  assert(footballEn700.lang === "en" && footballEn700.hash === "#football" && footballEn700.active?.endsWith("#football"), `Football EN at 700ms mismatch: ${JSON.stringify(footballEn700)}`);
  const footballEnStable = await waitForStableAnchor("football");
  await delay(1000);
  const footballEn1700 = await anchorState("football");
  assert(footballEn1700.hash === "#football" && footballEn1700.active?.endsWith("#football") && Math.abs(footballEn1700.top - footballEnStable.top) < 0.5, `Football EN after stabilization mismatch: ${JSON.stringify(footballEn1700)}`);

  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate(`${base}#dcf`);
  const mobileDcf = await waitForStableAnchor("dcf");
  assert(mobileDcf.top > 115 && mobileDcf.top < 145 && mobileDcf.overflow === 0, `Mobile DCF mismatch: ${JSON.stringify(mobileDcf)}`);

  const mobileEnPointer = await realPointerClick(visibleButton("EN"), "mobile EN");
  await delay(700);
  const mobileEn700 = await anchorState("dcf");
  assert(mobileEn700.lang === "en" && mobileEn700.hash === "#dcf" && mobileEn700.active?.endsWith("#dcf"), `Mobile EN at 700ms mismatch: ${JSON.stringify(mobileEn700)}`);
  const mobileEnStable = await waitForStableAnchor("dcf");
  await delay(1000);
  const mobileEn1700 = await anchorState("dcf");
  assert(mobileEn1700.hash === "#dcf" && mobileEn1700.active?.endsWith("#dcf") && mobileEn1700.overflow === 0 && Math.abs(mobileEn1700.top - mobileEnStable.top) < 0.5, `Mobile EN after stabilization mismatch: ${JSON.stringify(mobileEn1700)}`);

  await realPointerClick(visibleButton("Bull"), "Bull scenario");
  await waitFor(() => evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Bull')?.getAttribute('aria-pressed') === 'true'`), "Bull scenario");
  const bullHas497 = await evaluate("document.body.innerText.includes('€497m')");
  assert(bullHas497, "Bull scenario did not render €497m");
  await realPointerClick(visibleButton("Base"), "Base scenario");
  await waitFor(() => evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Base')?.getAttribute('aria-pressed') === 'true'`), "Base scenario");
  const baseHas301 = await evaluate("document.body.innerText.includes('€301m')");
  assert(baseHas301, "Base scenario did not restore €301m");

  assert(browserMessages.length === 0, `Browser warnings/errors: ${browserMessages.join(" | ")}`);
  console.log("Navigation browser behavior: PASS");
  console.log(JSON.stringify({
    base,
    direct,
    scrolled,
    footballPointer,
    footballFr,
    desktopEnPointer,
    footballEn700,
    footballEn1700,
    mobileDcf,
    mobileEnPointer,
    mobileEn700,
    mobileEn1700,
    bullHas497,
    baseHas301,
    browserMessages,
  }, null, 2));
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ id: ++nextId, method: "Browser.close", params: {} }));
    await delay(250);
    socket.close();
  }
  chrome.kill();
  await new Promise((resolve) => webServer.close(resolve));
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rm(profile, { force: true, recursive: true });
      break;
    } catch {
      await delay(100);
    }
  }
}
