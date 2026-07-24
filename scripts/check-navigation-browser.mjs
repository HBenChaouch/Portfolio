import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

const distRoot = path.resolve("dist");
// The public base path is derived from the artifact actually under test, not from
// the ambient environment: the browser gate must exercise whatever dist was built,
// so a build/env base mismatch surfaces explicitly instead of hiding behind a
// generic anchor timeout.
const distIndexHtml = await readFile(path.join(distRoot, "index.html"), "utf8");
const baseMatch = distIndexHtml.match(/(?:src|href)="(\/(?:[^"/]+\/)*)assets\//);
const publicBasePath = baseMatch ? baseMatch[1] : "/";
console.log(`[navigation] public base path detected from dist/index.html: ${publicBasePath}`);
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
    process.env.CHROME_BIN,
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
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
  if (filename.endsWith(".pdf")) return "application/pdf";
  if (filename.endsWith(".woff2")) return "font/woff2";
  if (filename.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "text/html; charset=utf-8";
}

const webServer = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const appPath = publicBasePath !== "/" && pathname.startsWith(publicBasePath)
      ? pathname.slice(publicBasePath.length)
      : pathname;
    const relativePath = appPath.replace(/^\/+/, "");
    let filename = path.resolve(distRoot, relativePath);
    if (!filename.startsWith(distRoot)) throw new Error("Path outside dist");

    try {
      const entry = await stat(filename);
      if (entry.isDirectory()) filename = path.join(filename, "index.html");
      else if (!entry.isFile()) filename = path.join(distRoot, "index.html");
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
const portfolioUrl = `http://127.0.0.1:${webPort}${publicBasePath}`;
const cdpPort = await availablePort();
const profile = await mkdtemp(path.join(tmpdir(), "sidetrade-navigation-"));
const chromePath = await findChrome();
const chromeArguments = [
  ...(process.env.S12_HEADFUL === "1" ? [] : ["--headless=new"]),
  `--remote-debugging-port=${cdpPort}`,
  "--remote-allow-origins=*",
  "--disable-background-networking",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--no-sandbox",
  "--no-first-run",
  "--no-default-browser-check",
  `--user-data-dir=${profile}`,
  "about:blank",
];
const chrome = spawn(chromePath, chromeArguments, { stdio: ["ignore", "pipe", "pipe"] });
let chromeDiagnostics = "";
for (const stream of [chrome.stdout, chrome.stderr]) {
  stream?.on("data", (chunk) => {
    chromeDiagnostics = `${chromeDiagnostics}${chunk}`.slice(-12000);
  });
}
const base = `${portfolioUrl}cases/sidetrade-valuation/analysis/`;

let socket;
let target;
let nextId = 0;
const pending = new Map();
const browserMessages = [];

async function waitForChrome() {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (chrome.exitCode !== null) {
      throw new Error(`Chrome exited before CDP became available (code ${chrome.exitCode}).\n${chromeDiagnostics}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
      if (response.ok) return;
    } catch {
      // Chrome is still starting.
    }
    await delay(100);
  }
  throw new Error(`Chrome DevTools endpoint did not start within 30 seconds.\n${chromeDiagnostics}`);
}

function command(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
    throw new Error(detail);
  }
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
  throw new Error(`Timed out waiting for ${label}. Browser messages: ${JSON.stringify(browserMessages.slice(-10))}`);
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

async function waitForStableSecondaryAnchor(anchor) {
  let previous;
  let stableSamples = 0;
  let current;
  await waitFor(async () => {
    current = await anchorState(anchor);
    const correctIdentity = current.hash === `#${anchor}` && Number.isFinite(current.top);
    const stableGeometry = previous
      && Math.abs(current.top - previous.top) < 0.5
      && current.documentHeight === previous.documentHeight;
    stableSamples = correctIdentity && stableGeometry ? stableSamples + 1 : 0;
    previous = current;
    return stableSamples >= 2;
  }, `stable secondary #${anchor}`);
  return current;
}

async function responsiveState(width, height, mobile = true) {
  await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  await navigate(`${base}#snapshot`);
  await waitForStableAnchor("snapshot");
  return evaluate(`(() => {
    const article = document.querySelector('.analysis-view');
    const offenders = Array.from(article.querySelectorAll('*')).filter((element) => {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || element.classList.contains('sr-only')) return false;
      return element.scrollWidth - element.clientWidth > 1;
    }).map((element) => ({
      className: element.className?.baseVal ?? element.className ?? '',
      clientWidth: element.clientWidth,
      id: element.id,
      scrollWidth: element.scrollWidth,
      tag: element.tagName,
      text: element.textContent?.trim().slice(0, 80),
    }));
    const scale = document.querySelector('.ff-reference-scale').getBoundingClientRect();
    const labels = Array.from(document.querySelectorAll('.ff-reference-scale .ref-label')).map((element) => {
      const rect = element.getBoundingClientRect();
      return { className: element.className, bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top };
    });
    const overlap = labels.some((label, index) => labels.slice(index + 1).some((other) => (
      label.left < other.right && label.right > other.left && label.top < other.bottom && label.bottom > other.top
    )));
    const references = ['market', 'fair', 'control'].map((kind) => {
      const markerElement = document.querySelector('.ff-guide.' + kind);
      const marker = markerElement.getBoundingClientRect();
      const markerStyle = getComputedStyle(markerElement);
      const label = document.querySelector('.ff-reference-scale .ref-label.' + kind).getBoundingClientRect();
      const expectedX = scale.left + parseFloat(markerElement.style.left) / 100 * scale.width;
      const hasContinuousStroke = markerStyle.backgroundImage === 'none'
        && markerStyle.borderLeftStyle !== 'dashed'
        && markerStyle.borderLeftStyle !== 'dotted'
        && (markerStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' || markerStyle.borderLeftStyle === 'solid');
      return { alignmentError: Math.abs(marker.left - expectedX), hasContinuousStroke, kind, labelX: label.left + label.width / 2, markerX: marker.left, onScale: marker.left >= scale.left - 1 && marker.left <= scale.right + 1 };
    });
    const guideRect = document.querySelector('.ff-guide-scale').getBoundingClientRect();
    const rangeTracks = Array.from(document.querySelectorAll('.ff-row:not(.ff-axis-row) .range-track')).map((element) => element.getBoundingClientRect());
    const guideCoversRows = guideRect.top <= rangeTracks[0].top + 1 && guideRect.bottom >= rangeTracks.at(-1).bottom - 1;
    const lboReading = document.querySelector('.ff-lbo-reading')?.textContent ?? '';
    const normalizedLboReading = lboReading.replaceAll(',', '.').replaceAll(' %', '%');
    const disclosureTargets = Array.from(document.querySelectorAll('.chart-disclosures summary, .transaction-cards summary, .peer-table .tip > summary'))
      .filter((element) => getComputedStyle(element).display !== 'none')
      .map((element) => element.getBoundingClientRect().height);
    const sidebar = document.querySelector('.case-sidebar');
    const sidebarLinks = document.querySelectorAll('#sidetrade-section-navigation .sidebar-entry');
    return {
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      offenders: innerWidth <= 760 ? offenders : [],
      labelsOverlap: overlap,
      references,
      guideCoversRows,
      lboReadingComplete: ['222.5', '241.9', '283.5', '25%', '22.5%', '18%'].every((value) => normalizedLboReading.includes(value)),
      sidebar: {
        clientHeight: sidebar.clientHeight,
        linkCount: sidebarLinks.length,
        scrollHeight: sidebar.scrollHeight,
      },
      minDisclosureTarget: Math.min(...disclosureTargets),
      transactionCards: getComputedStyle(document.querySelector('.transaction-cards')).display,
      verticalWaterfall: getComputedStyle(document.querySelector('.waterfall-mobile')).display,
      viewport: { width: innerWidth, height: innerHeight },
    };
  })()`);
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
      sessionStorage.setItem('__s12PointerDown', JSON.stringify(window.__s12PointerDown));
    }, { capture: true, once: true });
    return { x, y };
  })()`);
  assert(!point.error, `${label} cannot receive a pointer click: ${JSON.stringify(point)}`);

  await command("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await command("Input.dispatchMouseEvent", { button: "left", buttons: 1, clickCount: 1, type: "mousePressed", x: point.x, y: point.y });
  await command("Input.dispatchMouseEvent", { button: "left", buttons: 0, clickCount: 1, type: "mouseReleased", x: point.x, y: point.y });
  const pointerEvent = await evaluate("window.__s12PointerDown ?? JSON.parse(sessionStorage.getItem('__s12PointerDown') || 'null')");
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
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params.exceptionDetails;
      browserMessages.push(`exception: ${details.exception?.description ?? details.text}`);
    }
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
  // Fail fast with an explicit cause if the SPA never mounts under the served base
  // (build/env base mismatch), rather than letting the #dcf stability wait time out generically.
  await waitFor(
    () => evaluate("Boolean(document.querySelector('.analysis-view'))"),
    `analysis view mount under base ${publicBasePath} — check that dist was built for this base`,
    40,
  );
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

  const desktopLayouts = [];
  for (const viewport of [[1280, 720], [1920, 1080]]) {
    const state = await responsiveState(...viewport, false);
    assert(state.documentOverflow === 0, `Desktop document overflow at ${viewport.join("x")}: ${JSON.stringify(state)}`);
    assert(!state.labelsOverlap, `Desktop football labels overlap at ${viewport.join("x")}: ${JSON.stringify(state)}`);
    assert(state.references.every((reference) => reference.onScale && reference.alignmentError < 1 && reference.hasContinuousStroke), `Desktop football scale or guide continuity mismatch at ${viewport.join("x")}: ${JSON.stringify(state.references)}`);
    assert(state.guideCoversRows && state.lboReadingComplete, `Desktop football guide or LBO reading mismatch at ${viewport.join("x")}: ${JSON.stringify(state)}`);
    assert(state.sidebar.linkCount === 11, `Desktop sidebar destination count mismatch at ${viewport.join("x")}: ${JSON.stringify(state.sidebar)}`);
    assert(state.sidebar.scrollHeight <= state.sidebar.clientHeight + 1, `Desktop sidebar still requires scrolling at ${viewport.join("x")}: ${JSON.stringify(state.sidebar)}`);
    desktopLayouts.push(state);
  }

  const responsive = [];
  for (const viewport of [[360, 800], [390, 844], [430, 932]]) {
    const state = await responsiveState(...viewport);
    assert(state.documentOverflow === 0, `Document overflow at ${viewport.join("x")}: ${JSON.stringify(state)}`);
    assert(state.offenders.length === 0, `Horizontal narration overflow at ${viewport.join("x")}: ${JSON.stringify(state.offenders)}`);
    assert(!state.labelsOverlap, `Football labels overlap at ${viewport.join("x")}: ${JSON.stringify(state)}`);
    assert(state.references.every((reference) => reference.onScale && reference.alignmentError < 1 && reference.hasContinuousStroke), `Football reference outside common scale or discontinuous at ${viewport.join("x")}: ${JSON.stringify(state.references)}`);
    assert(state.guideCoversRows && state.lboReadingComplete, `Mobile football guide or LBO reading mismatch at ${viewport.join("x")}: ${JSON.stringify(state)}`);
    assert(state.sidebar.linkCount === 11, `Mobile summary destination count mismatch at ${viewport.join("x")}: ${JSON.stringify(state.sidebar)}`);
    assert(state.minDisclosureTarget >= 44, `Disclosure target below 44px at ${viewport.join("x")}: ${state.minDisclosureTarget}`);
    assert(state.transactionCards === "grid" && state.verticalWaterfall === "grid", `Mobile representations missing at ${viewport.join("x")}: ${JSON.stringify(state)}`);
    responsive.push(state);
  }

  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate(`${base}#methodology`);
  const removedAnchorDirect = await waitForStableSecondaryAnchor("methodology");
  assert(removedAnchorDirect.top > 115 && removedAnchorDirect.top < 145, `Removed sidebar anchor must remain directly addressable: ${JSON.stringify(removedAnchorDirect)}`);

  await navigate(`${base}#executive`);
  await waitForStableAnchor("executive");
  const mobileSummaryPointer = await realPointerClick("document.querySelector('.mobile-nav-toggle')", "mobile contents");
  const mobileSummaryOpen = await evaluate(`(() => {
    const nav = document.querySelector('#sidetrade-section-navigation');
    const links = Array.from(nav.querySelectorAll('.sidebar-entry'));
    return {
      linkCount: links.length,
      minTarget: Math.min(...links.map((link) => link.getBoundingClientRect().height)),
      open: nav.classList.contains('mobile-open'),
    };
  })()`);
  assert(mobileSummaryOpen.open && mobileSummaryOpen.linkCount === 11 && mobileSummaryOpen.minTarget >= 44, `Mobile summary mismatch: ${JSON.stringify(mobileSummaryOpen)}`);
  const mobileMarketPointer = await realPointerClick("document.querySelector('#sidetrade-section-navigation a[href$=\"#market\"]')", "mobile Market reference");
  const mobileMarket = await waitForStableAnchor("market");
  const mobileSummaryClosed = await evaluate("!document.querySelector('#sidetrade-section-navigation').classList.contains('mobile-open')");
  assert(mobileSummaryClosed && mobileMarket.hash === '#market', `Mobile summary did not close after selection: ${JSON.stringify({ mobileMarket, mobileSummaryClosed })}`);

  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate(`${base}#trading`);
  await waitForStableAnchor("trading");
  const peerDisclosurePointer = await realPointerClick("document.querySelector('.peer-table details.tip > summary')", "peer rationale disclosure");
  const peerDisclosureOpen = await evaluate("document.querySelector('.peer-table details.tip')?.open === true");
  assert(peerDisclosureOpen, "Peer rationale did not open after a trusted pointer interaction");

  await navigate(`${base}#transaction`);
  await waitForStableAnchor("transaction");
  const transactionDisclosurePointer = await realPointerClick("document.querySelector('.transaction-cards details > summary')", "transaction detail disclosure");
  const transactionDisclosureOpen = await evaluate("document.querySelector('.transaction-cards details')?.open === true");
  assert(transactionDisclosureOpen, "Transaction detail did not open after a trusted pointer interaction");

  await navigate(`${base}#dcf`);
  await waitForStableAnchor("dcf");
  await evaluate("document.querySelector('.chart-disclosures details > summary')?.focus()");
  await command("Input.dispatchKeyEvent", { key: " ", code: "Space", type: "keyDown", windowsVirtualKeyCode: 32 });
  await command("Input.dispatchKeyEvent", { key: " ", code: "Space", type: "keyUp", windowsVirtualKeyCode: 32 });
  const chartDisclosureOpen = await evaluate("document.querySelector('.chart-disclosures details')?.open === true");
  assert(chartDisclosureOpen, "Trajectory detail did not open from the keyboard");

  await command("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const cockpitUrl = `${portfolioUrl}cases/real-estate-downside/`;
  await navigate(`${cockpitUrl}#tresorerie`);
  await waitFor(() => evaluate("Boolean(window.__COCKPIT__?.runSelfTests)"), "Real Estate cockpit initialization");
  const cockpitInitial = await evaluate(`(() => {
    const tests = window.__COCKPIT__.runSelfTests();
    const back = document.querySelector('.portfolio-back');
    const nav = document.querySelector('.cockpit-shell-header');
    const sidebar = document.querySelector('#cockpit-sidebar');
    const navLinks = Array.from(document.querySelectorAll('#cockpit-section-navigation a'));
    return {
      backHref: back?.href,
      backTarget: back?.getAttribute('target'),
      downloads: Array.from(document.querySelectorAll('.dl-card')).map((link) => ({
        download: link.hasAttribute('download') || link.id === 'dl-csv',
        href: link.getAttribute('href'),
        target: link.getAttribute('target'),
      })),
      oldDomainPresent: document.documentElement.innerHTML.includes('hbenchaouch.github.io/cockpit-fund-controlling'),
      nav: {
        allVisible: navLinks.every((link) => {
          const rect = link.getBoundingClientRect();
          return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
        }),
        height: nav?.getBoundingClientRect().height,
        labels: navLinks.map((link) => link.textContent.trim()),
        linkCount: navLinks.length,
        minFontSize: Math.min(...navLinks.map((link) => parseFloat(getComputedStyle(link).fontSize))),
        sidebarFits: sidebar.scrollHeight <= sidebar.clientHeight,
        toggleDisplay: getComputedStyle(document.querySelector('.cockpit-nav-toggle')).display,
      },
      shell: {
        banners: document.querySelectorAll('body > header').length,
        brandTag: document.querySelector('.cockpit-nav-brand')?.tagName,
        hashControls: Array.from(document.querySelectorAll('.cockpit-shell-header a[href^="#"], #cockpit-sidebar a[href^="#"]')).map((link) => link.hash),
        scenarioGroups: document.querySelectorAll('.scenario-buttons').length,
      },
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      passed: tests.passed,
      total: tests.total,
      title: document.title,
    };
  })()`);
  assert(cockpitInitial.passed === 13 && cockpitInitial.total === 13, `Cockpit self-tests mismatch: ${JSON.stringify(cockpitInitial)}`);
  assert(cockpitInitial.backHref === portfolioUrl && cockpitInitial.backTarget === null, `Cockpit return mismatch: ${JSON.stringify(cockpitInitial)}`);
  assert(cockpitInitial.downloads.length === 3 && cockpitInitial.downloads.every((link) => link.download && link.target === null), `Cockpit downloads mismatch: ${JSON.stringify(cockpitInitial.downloads)}`);
  assert(!cockpitInitial.oldDomainPresent && cockpitInitial.overflow === 0, `Cockpit public integration mismatch: ${JSON.stringify(cockpitInitial)}`);
  assert(cockpitInitial.nav.linkCount === 8 && cockpitInitial.nav.allVisible && cockpitInitial.nav.sidebarFits && cockpitInitial.nav.minFontSize > 10 && cockpitInitial.nav.toggleDisplay === "none", `Cockpit desktop navigation mismatch: ${JSON.stringify(cockpitInitial.nav)}`);
  assert(cockpitInitial.shell.banners === 1 && cockpitInitial.shell.brandTag === "SPAN" && cockpitInitial.shell.scenarioGroups === 1 && new Set(cockpitInitial.shell.hashControls).size === 8 && cockpitInitial.shell.hashControls.length === 8, `Cockpit shell duplication mismatch: ${JSON.stringify(cockpitInitial.shell)}`);

  await navigate(`${cockpitUrl}?lang=en#covenants`);
  await waitFor(() => evaluate("document.documentElement.lang === 'en' && Boolean(window.__COCKPIT__?.runSelfTests)"), "English Cockpit initialization");
  await delay(250);
  const cockpitEnglishProbe = await evaluate(`(() => ({
    ariaLabels: Array.from(document.querySelectorAll('[aria-label]')).map((node) => node.getAttribute('aria-label')),
    backHref: document.querySelector('.portfolio-back')?.getAttribute('href'),
    frenchResiduals: Array.from(new Set(
      (document.documentElement.textContent.match(/\\b(?:actifs?|alerte|avant|blocage|bureaux?|charges|commentaire|contrôle|couverture|démonstration|dette|durée|écart|fonds|hausse|impayés?|limites?|loyers?|méthodologie|modèle|prêteurs?|réalisé|référence|réglementaire|résidentiel|scénario|seuil|taux|télécharger|trésorerie|valeur|vacance)\\b/giu) ?? [])
        .map((value) => value.toLocaleLowerCase('fr-FR'))
    )),
    hash: location.hash,
    language: document.documentElement.lang,
    visibleText: document.body.innerText.slice(0, 1200),
    title: document.title,
    url: location.href,
  }))()`);
  assert(cockpitEnglishProbe.language === "en" && cockpitEnglishProbe.hash === "#covenants" && cockpitEnglishProbe.backHref === `${publicBasePath}?lang=en`, `Direct English Cockpit mismatch: ${JSON.stringify(cockpitEnglishProbe)}`);
  assert(cockpitEnglishProbe.frenchResiduals.length === 0, `French residuals in English Cockpit: ${JSON.stringify(cockpitEnglishProbe.frenchResiduals)}`);
  assert(cockpitEnglishProbe.ariaLabels.every((label) => !/\b(?:langue|navigation et scénario|sections du|générer|retour au)\b/i.test(label)), `French accessible label in English Cockpit: ${JSON.stringify(cockpitEnglishProbe.ariaLabels)}`);

  await navigate(`${cockpitUrl}?lang=en&scenario=bear#tresorerie`);
  await waitFor(() => evaluate("document.documentElement.lang === 'en' && document.querySelector('#scenario-bear')?.getAttribute('aria-pressed') === 'true'"), "English Cockpit Bear typography");
  const cockpitEnglishPercentages = await evaluate(`(() => {
    const selectors = ['#kpid-gav', '#kpid-nav', '#kpid-noi', '#out-rent'];
    return selectors.map((selector) => document.querySelector(selector)?.textContent.trim());
  })()`);
  assert(
    cockpitEnglishPercentages.some((text) => text?.includes("-30.3%"))
      && cockpitEnglishPercentages.some((text) => text?.includes("-56.4%"))
      && cockpitEnglishPercentages.some((text) => text?.includes("-13.6%"))
      && cockpitEnglishPercentages.some((text) => /^[-−]10%$/.test(text ?? ""))
      && cockpitEnglishPercentages.every((text) => !/[\u00a0\u202f]%/.test(text ?? "")),
    `English dynamic percentage typography mismatch: ${JSON.stringify(cockpitEnglishPercentages)}`,
  );

  const cockpitLanguageTransitions = [];
  for (const anchor of ["covenants", "stress", "methodo"]) {
    await navigate(`${cockpitUrl}#${anchor}`);
    await waitFor(() => evaluate(`location.hash === '#${anchor}' && document.documentElement.lang === 'fr' && document.querySelector('#cockpit-section-navigation a[aria-current="location"]')?.hash === '#${anchor}'`), `French Cockpit #${anchor}`);
    const before = await evaluate("({ gav: window.__COCKPIT__.state.gav, nav: window.__COCKPIT__.state.nav, noi: window.__COCKPIT__.state.noi, ltv: window.__COCKPIT__.state.ltv, dscr: window.__COCKPIT__.state.dscr })");
    const englishPointer = await realPointerClick("document.querySelector('[data-language=\"en\"]')", `Cockpit EN on #${anchor}`);
    let englishState;
    await waitFor(async () => {
      englishState = await evaluate(`(() => {
        const target = document.querySelector('#${anchor}');
        const header = document.querySelector('.cockpit-shell-header');
        return {
          active: document.querySelector('#cockpit-section-navigation a[aria-current="location"]')?.hash,
          backHref: document.querySelector('.portfolio-back')?.getAttribute('href'),
          hash: location.hash,
          lang: document.documentElement.lang,
          search: location.search,
          top: target?.getBoundingClientRect().top,
          headerBottom: header?.getBoundingClientRect().bottom,
          viewportHeight: innerHeight,
          values: { gav: window.__COCKPIT__.state.gav, nav: window.__COCKPIT__.state.nav, noi: window.__COCKPIT__.state.noi, ltv: window.__COCKPIT__.state.ltv, dscr: window.__COCKPIT__.state.dscr },
        };
      })()`);
      return englishState.lang === "en"
        && englishState.search === "?lang=en"
        && englishState.hash === `#${anchor}`
        && englishState.active === `#${anchor}`
        && englishState.top >= englishState.headerBottom
        && englishState.top < englishState.viewportHeight - 20;
    }, `stable English Cockpit #${anchor}`);
    assert(JSON.stringify(englishState.values) === JSON.stringify(before), `Financial values changed on Cockpit language toggle #${anchor}: ${JSON.stringify({ before, after: englishState.values })}`);
    await command("Page.reload", { ignoreCache: true });
    await waitFor(() => evaluate(`document.documentElement.lang === 'en' && location.search === '?lang=en' && location.hash === '#${anchor}' && document.querySelector('#cockpit-section-navigation a[aria-current="location"]')?.hash === '#${anchor}'`), `English Cockpit #${anchor} refresh`);
    const frenchPointer = await realPointerClick("document.querySelector('[data-language=\"fr\"]')", `Cockpit FR on #${anchor}`);
    await waitFor(() => evaluate(`document.documentElement.lang === 'fr' && location.search === '' && location.hash === '#${anchor}' && document.querySelector('#cockpit-section-navigation a[aria-current="location"]')?.hash === '#${anchor}'`), `restored French Cockpit #${anchor}`);
    cockpitLanguageTransitions.push({ anchor, englishPointer, englishState, frenchPointer });
  }

  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await navigate(`${cockpitUrl}?lang=en#methodo`);
  await waitFor(() => evaluate("document.documentElement.lang === 'en' && location.hash === '#methodo'"), "English Cockpit content scan");
  await evaluate("document.querySelectorAll('#methodo details').forEach((details) => { details.open = true; })");
  await evaluate("location.hash = '#commentaire'");
  await waitFor(() => evaluate("document.querySelector('#commentaire')?.getBoundingClientRect().top >= document.querySelector('.cockpit-shell-header')?.getBoundingClientRect().bottom && document.querySelector('#commentaire')?.getBoundingClientRect().top < innerHeight"), "English commentary anchor");
  await realPointerClick("document.querySelector('#btn-comment')", "English management commentary");
  await waitFor(() => evaluate("document.querySelector('.answer p')?.textContent.length > 500 && !document.querySelector('#btn-comment')?.classList.contains('busy')"), "English generated commentary");
  const cockpitEnglishFullScan = await evaluate(`(() => ({
    csvFilename: window.COCKPIT_I18N.t('csv.filename'),
    frenchResiduals: Array.from(new Set(
      (document.documentElement.textContent.match(/\\b(?:actifs?|alerte|avant|blocage|bureaux?|charges|commentaire|contrôle|couverture|démonstration|dette|durée|écart|fonds|hausse|impayés?|limites?|loyers?|méthodologie|modèle|prêteurs?|réalisé|référence|réglementaire|résidentiel|scénario|seuil|taux|télécharger|trésorerie|valeur|vacance)\\b/giu) ?? [])
        .map((value) => value.toLocaleLowerCase('fr-FR'))
    )),
    generatedComment: document.querySelector('.answer p')?.textContent,
    glossaryOpen: Array.from(document.querySelectorAll('#methodo details')).every((details) => details.open),
  }))()`);
  assert(cockpitEnglishFullScan.glossaryOpen && cockpitEnglishFullScan.csvFilename === "core_plus_france_asset_register.csv", `English disclosures/download mismatch: ${JSON.stringify(cockpitEnglishFullScan)}`);
  assert(cockpitEnglishFullScan.frenchResiduals.length === 0, `French residuals in full English Cockpit DOM: ${JSON.stringify(cockpitEnglishFullScan.frenchResiduals)}`);
  await navigate(`${cockpitUrl}#consolidation`);
  await waitFor(() => evaluate("document.documentElement.lang === 'fr' && Boolean(window.__COCKPIT__?.runSelfTests)"), "French Cockpit restoration");

  await command("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await navigate(`${cockpitUrl}?viewport=1920#consolidation`);
  await waitFor(() => evaluate("Boolean(window.__COCKPIT__?.runSelfTests)"), "wide Cockpit initialization");
  const cockpitWide = await evaluate(`(() => {
    const links = Array.from(document.querySelectorAll('#cockpit-section-navigation a'));
    const sidebar = document.querySelector('#cockpit-sidebar');
    return {
      allVisible: links.every((link) => {
        const rect = link.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
      }),
      linkCount: links.length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sidebarFits: sidebar.scrollHeight <= sidebar.clientHeight,
    };
  })()`);
  assert(cockpitWide.linkCount === 8 && cockpitWide.allVisible && cockpitWide.sidebarFits && cockpitWide.overflow === 0, `Wide Cockpit navigation mismatch: ${JSON.stringify(cockpitWide)}`);

  await command("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const cockpitAnchors = ["consolidation", "covenants", "stress", "portefeuille", "tresorerie", "analyse", "commentaire", "ressources", "methodo"];
  const cockpitAnchorResults = [];
  for (const anchor of cockpitAnchors) {
    await navigate(`${cockpitUrl}?anchor=${anchor}#${anchor}`);
    await waitFor(() => evaluate("Boolean(window.__COCKPIT__?.runSelfTests)"), `Cockpit #${anchor} initialization`);
    let state;
    const expectedActive = anchor === "analyse" ? "#tresorerie" : `#${anchor}`;
    await waitFor(async () => {
      state = await evaluate(`(() => {
        const target = document.querySelector('#${anchor}');
        const nav = document.querySelector('.cockpit-shell-header');
        return {
          active: document.querySelector('#cockpit-section-navigation a[aria-current="location"]')?.getAttribute('href'),
          hash: location.hash,
          navHeight: nav?.getBoundingClientRect().height,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          top: target?.getBoundingClientRect().top,
          viewportHeight: innerHeight,
        };
      })()`);
      return state.hash === `#${anchor}`
        && state.active === expectedActive
        && state.top >= state.navHeight
        && state.top < state.viewportHeight - 40;
    }, `Cockpit stable #${anchor}`);
    assert(state.overflow === 0, `Cockpit #${anchor} overflow: ${JSON.stringify(state)}`);
    cockpitAnchorResults.push(state);
  }

  await command("Page.reload", { ignoreCache: true });
  await waitFor(() => evaluate("document.readyState === 'complete' && Boolean(window.__COCKPIT__?.runSelfTests)"), "Cockpit #methodo refresh");
  let cockpitMethodoRefresh;
  await waitFor(async () => {
    cockpitMethodoRefresh = await evaluate(`(() => {
      const nav = document.querySelector('.cockpit-shell-header');
      return {
        active: document.querySelector('#cockpit-section-navigation a[aria-current="location"]')?.getAttribute('href'),
        hash: location.hash,
        navHeight: nav?.getBoundingClientRect().height,
        top: document.querySelector('#methodo')?.getBoundingClientRect().top,
        viewportHeight: innerHeight,
      };
    })()`);
    return cockpitMethodoRefresh.hash === "#methodo"
      && cockpitMethodoRefresh.active === "#methodo"
      && cockpitMethodoRefresh.top >= cockpitMethodoRefresh.navHeight
      && cockpitMethodoRefresh.top < cockpitMethodoRefresh.viewportHeight - 40;
  }, "Cockpit stable #methodo after refresh");
  await evaluate("window.scrollTo(0, document.documentElement.scrollHeight)");
  await delay(120);
  const cockpitFooterGapDesktop = await evaluate(`(() => {
    const footer = document.querySelector('footer').getBoundingClientRect();
    return {
      gap: Math.max(0, innerHeight - footer.bottom),
      mainPaddingBottom: parseFloat(getComputedStyle(document.querySelector('main')).paddingBottom),
      scrollRemainder: document.documentElement.scrollHeight - (scrollY + innerHeight),
    };
  })()`);
  assert(cockpitFooterGapDesktop.gap < 8 && cockpitFooterGapDesktop.mainPaddingBottom === 0 && cockpitFooterGapDesktop.scrollRemainder < 1, `Cockpit desktop footer spacer mismatch: ${JSON.stringify(cockpitFooterGapDesktop)}`);

  await navigate(`${cockpitUrl}#tresorerie`);
  await waitFor(() => evaluate("Boolean(window.__COCKPIT__?.runSelfTests)"), "Cockpit treasury scenario initialization");
  const cockpitBearPointer = await realPointerClick("document.querySelector('#scenario-bear')", "Cockpit Bear scenario");
  let cockpitBearState;
  await waitFor(async () => {
    cockpitBearState = await evaluate(`(() => ({
      active: document.querySelector('#scenario-bear')?.getAttribute('aria-pressed'),
      global: document.querySelector('#global-scenario-state')?.textContent.trim(),
      hash: location.hash,
      indicators: Array.from(document.querySelectorAll('[data-scenario-indicator]')).map((item) => item.textContent.trim()),
      note: document.querySelector('#tr-note')?.textContent.trim(),
      search: location.search,
      treasury: document.querySelector('#tr-tfoot')?.textContent.replace(/\\s+/g, ' ').trim(),
    }))()`);
    return cockpitBearState.active === "true"
      && cockpitBearState.hash === "#tresorerie"
      && cockpitBearState.search === "?scenario=bear"
      && cockpitBearState.indicators.length === 7
      && cockpitBearState.indicators.every((text) => text === "Scénario actif : Bear")
      && /suspendues/i.test(cockpitBearState.note)
      && /0,00/.test(cockpitBearState.treasury)
      && /11,70/.test(cockpitBearState.treasury);
  }, "Cockpit Bear scenario from treasury");

  const cockpitBasePointer = await realPointerClick("document.querySelector('#scenario-base')", "Cockpit Base scenario");
  let cockpitBaseState;
  await waitFor(async () => {
    cockpitBaseState = await evaluate(`(() => ({
      active: document.querySelector('#scenario-base')?.getAttribute('aria-pressed'),
      global: document.querySelector('#global-scenario-state')?.textContent.trim(),
      hash: location.hash,
      indicators: Array.from(document.querySelectorAll('[data-scenario-indicator]')).map((item) => item.textContent.trim()),
      note: document.querySelector('#tr-note')?.textContent.trim(),
      search: location.search,
      treasury: document.querySelector('#tr-tfoot')?.textContent.replace(/\\s+/g, ' ').trim(),
    }))()`);
    return cockpitBaseState.active === "true"
      && cockpitBaseState.hash === "#tresorerie"
      && cockpitBaseState.search === ""
      && cockpitBaseState.indicators.every((text) => text === "Scénario actif : Base")
      && /−7,00/.test(cockpitBaseState.treasury)
      && /7,59/.test(cockpitBaseState.treasury);
  }, "Cockpit Base scenario from treasury");

  await evaluate("document.querySelector('#in-rent').focus()");
  await command("Input.dispatchKeyEvent", { key: "ArrowLeft", code: "ArrowLeft", type: "keyDown", windowsVirtualKeyCode: 37 });
  await command("Input.dispatchKeyEvent", { key: "ArrowLeft", code: "ArrowLeft", type: "keyUp", windowsVirtualKeyCode: 37 });
  let cockpitCustomState;
  await waitFor(async () => {
    cockpitCustomState = await evaluate(`(() => ({
      global: document.querySelector('#global-scenario-state')?.textContent.trim(),
      hash: location.hash,
      indicators: Array.from(document.querySelectorAll('[data-scenario-indicator]')).map((item) => item.textContent.trim()),
      search: location.search,
    }))()`);
    return cockpitCustomState.global === "Scénario actif : Personnalisé"
      && cockpitCustomState.hash === "#tresorerie"
      && cockpitCustomState.search.includes("scenario=custom")
      && cockpitCustomState.indicators.every((text) => text === "Scénario actif : Personnalisé");
  }, "Cockpit custom scenario after keyboard slider change");

  await navigate(`${cockpitUrl}?scenario=bear#tresorerie`);
  await waitFor(() => evaluate("document.querySelector('#scenario-bear')?.getAttribute('aria-pressed') === 'true' && location.hash === '#tresorerie'"), "Cockpit direct Bear scenario");
  await command("Page.reload", { ignoreCache: true });
  await waitFor(() => evaluate("document.readyState === 'complete' && document.querySelector('#scenario-bear')?.getAttribute('aria-pressed') === 'true' && location.search === '?scenario=bear' && location.hash === '#tresorerie'"), "Cockpit Bear scenario refresh");
  const cockpitAfterRefresh = await evaluate("(() => { const tests = window.__COCKPIT__.runSelfTests(); return { href: location.href, indicator: document.querySelector('#tresorerie [data-scenario-indicator]')?.textContent.trim(), passed: tests.passed, total: tests.total }; })()");
  assert(cockpitAfterRefresh.indicator === "Scénario actif : Bear" && cockpitAfterRefresh.passed === 13 && cockpitAfterRefresh.total === 13, `Cockpit refresh mismatch: ${JSON.stringify(cockpitAfterRefresh)}`);

  const cockpitMobileLayouts = [];
  for (const [width, height] of [[360, 800], [390, 844], [430, 932]]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
    await navigate(`${cockpitUrl}?mobile=${width}#analyse`);
    await waitFor(() => evaluate("Boolean(window.__COCKPIT__?.runSelfTests)"), `mobile Cockpit ${width}px initialization`);
    let state;
    await waitFor(async () => {
      state = await evaluate(`(() => {
        const nav = document.querySelector('.cockpit-shell-header');
        const toggle = document.querySelector('.cockpit-nav-toggle');
        const languageTargets = Array.from(document.querySelectorAll('.cockpit-language-toggle button'))
          .map((button) => button.getBoundingClientRect());
        return {
          active: document.querySelector('#cockpit-section-navigation a[aria-current="location"]')?.getAttribute('href'),
          hash: location.hash,
          languageTargetHeight: Math.min(...languageTargets.map((rect) => rect.height)),
          languageTargetWidth: Math.min(...languageTargets.map((rect) => rect.width)),
          navHeight: nav?.getBoundingClientRect().height,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          targetTop: document.querySelector('#analyse')?.getBoundingClientRect().top,
          toggleHeight: toggle?.getBoundingClientRect().height,
        };
      })()`);
      return state.hash === "#analyse"
        && state.active === "#tresorerie"
        && Math.abs(state.targetTop - (state.navHeight + 16)) < 1.5;
    }, `mobile Cockpit ${width}px #analyse`);
    assert(
      state.overflow === 0
        && state.toggleHeight >= 44
        && state.languageTargetHeight >= 44
        && state.languageTargetWidth >= 44,
      `Mobile Cockpit layout mismatch at ${width}x${height}: ${JSON.stringify(state)}`,
    );
    await waitFor(async () => {
      await evaluate("window.scrollTo(0, document.documentElement.scrollHeight)");
      state.footer = await evaluate(`(() => {
        const footer = document.querySelector('footer').getBoundingClientRect();
        return {
          gap: Math.max(0, innerHeight - footer.bottom),
          mainPaddingBottom: parseFloat(getComputedStyle(document.querySelector('main')).paddingBottom),
          scrollRemainder: document.documentElement.scrollHeight - (scrollY + innerHeight),
        };
      })()`);
      return state.footer.gap < 8
        && state.footer.mainPaddingBottom === 0
        && state.footer.scrollRemainder < 1;
    }, `mobile Cockpit ${width}px footer geometry`);
    assert(state.footer.gap < 8 && state.footer.mainPaddingBottom === 0 && state.footer.scrollRemainder < 1, `Mobile Cockpit footer spacer mismatch at ${width}x${height}: ${JSON.stringify(state.footer)}`);
    cockpitMobileLayouts.push({ ...state, viewport: { width, height } });
  }

  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate(`${cockpitUrl}#tresorerie`);
  await waitFor(() => evaluate("document.readyState === 'complete' && Boolean(window.__COCKPIT__?.runSelfTests)"), "mobile cockpit refresh");
  const cockpitMobile = await evaluate(`(() => {
    const back = document.querySelector('.portfolio-back').getBoundingClientRect();
    const toggle = document.querySelector('.cockpit-nav-toggle').getBoundingClientRect();
    const tests = window.__COCKPIT__.runSelfTests();
    return {
      backHeight: back.height,
      backVisible: back.top >= 0 && back.bottom <= innerHeight,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      passed: tests.passed,
      toggleHeight: toggle.height,
      total: tests.total,
    };
  })()`);
  assert(cockpitMobile.overflow === 0 && cockpitMobile.backVisible && cockpitMobile.backHeight >= 44 && cockpitMobile.toggleHeight >= 44 && cockpitMobile.passed === 13 && cockpitMobile.total === 13, `Mobile cockpit mismatch: ${JSON.stringify(cockpitMobile)}`);

  const cockpitMenuPointer = await realPointerClick("document.querySelector('.cockpit-nav-toggle')", "Cockpit mobile contents");
  const cockpitMenuOpen = await evaluate(`(() => {
    const sidebar = document.querySelector('#cockpit-sidebar');
    const links = Array.from(sidebar.querySelectorAll('nav a'));
    return {
      expanded: document.querySelector('.cockpit-nav-toggle').getAttribute('aria-expanded'),
      linkCount: links.length,
      minTarget: Math.min(...links.map((link) => link.getBoundingClientRect().height)),
      scenarioTargets: Array.from(sidebar.querySelectorAll('.scenario-button')).map((button) => button.getBoundingClientRect().height),
      open: sidebar.classList.contains('is-open'),
    };
  })()`);
  assert(cockpitMenuOpen.expanded === "true" && cockpitMenuOpen.linkCount === 8 && cockpitMenuOpen.minTarget >= 44 && cockpitMenuOpen.scenarioTargets.every((height) => height >= 44) && cockpitMenuOpen.open, `Cockpit mobile menu mismatch: ${JSON.stringify(cockpitMenuOpen)}`);
  await command("Input.dispatchKeyEvent", { key: "Escape", code: "Escape", type: "keyDown", windowsVirtualKeyCode: 27 });
  await command("Input.dispatchKeyEvent", { key: "Escape", code: "Escape", type: "keyUp", windowsVirtualKeyCode: 27 });
  const cockpitMenuEscape = await evaluate(`(() => ({
    expanded: document.querySelector('.cockpit-nav-toggle').getAttribute('aria-expanded'),
    focused: document.activeElement === document.querySelector('.cockpit-nav-toggle'),
    open: document.querySelector('#cockpit-sidebar').classList.contains('is-open'),
  }))()`);
  assert(cockpitMenuEscape.expanded === "false" && cockpitMenuEscape.focused && !cockpitMenuEscape.open, `Cockpit Escape mismatch: ${JSON.stringify(cockpitMenuEscape)}`);

  await realPointerClick("document.querySelector('.cockpit-nav-toggle')", "Cockpit mobile contents for Bear");
  const cockpitMobileBearPointer = await realPointerClick("document.querySelector('#scenario-bear')", "Cockpit mobile Bear scenario");
  await waitFor(() => evaluate("location.hash === '#tresorerie' && location.search === '?scenario=bear' && document.querySelector('#scenario-bear')?.getAttribute('aria-pressed') === 'true' && !document.querySelector('#cockpit-sidebar')?.classList.contains('is-open') && document.activeElement === document.querySelector('.cockpit-nav-toggle')"), "Cockpit mobile Bear state");
  await realPointerClick("document.querySelector('.cockpit-nav-toggle')", "Cockpit mobile contents for Base");
  const cockpitMobileBasePointer = await realPointerClick("document.querySelector('#scenario-base')", "Cockpit mobile Base scenario");
  await waitFor(() => evaluate("location.hash === '#tresorerie' && location.search === '' && document.querySelector('#scenario-base')?.getAttribute('aria-pressed') === 'true' && !document.querySelector('#cockpit-sidebar')?.classList.contains('is-open') && document.activeElement === document.querySelector('.cockpit-nav-toggle')"), "Cockpit mobile Base state");

  await evaluate("document.querySelector('.cockpit-nav-toggle').focus()");
  await command("Input.dispatchKeyEvent", { key: "Enter", code: "Enter", type: "keyDown", windowsVirtualKeyCode: 13 });
  await command("Input.dispatchKeyEvent", { key: "Enter", code: "Enter", type: "keyUp", windowsVirtualKeyCode: 13 });
  await waitFor(() => evaluate("document.querySelector('#cockpit-sidebar').classList.contains('is-open')"), "Cockpit keyboard menu open");
  const cockpitToggleFocus = await evaluate(`(() => {
    const style = getComputedStyle(document.querySelector('.cockpit-nav-toggle'));
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  })()`);
  assert(parseFloat(cockpitToggleFocus.outlineWidth) >= 2 && cockpitToggleFocus.outlineStyle !== "none", `Cockpit toggle focus mismatch: ${JSON.stringify(cockpitToggleFocus)}`);
  await evaluate("document.querySelector('#cockpit-section-navigation a[href=\"#methodo\"]').focus()");
  await command("Input.dispatchKeyEvent", { key: "Enter", code: "Enter", type: "keyDown", windowsVirtualKeyCode: 13 });
  await command("Input.dispatchKeyEvent", { key: "Enter", code: "Enter", type: "keyUp", windowsVirtualKeyCode: 13 });
  let cockpitKeyboardMethodo;
  await waitFor(async () => {
    cockpitKeyboardMethodo = await evaluate(`(() => {
      const nav = document.querySelector('.cockpit-shell-header');
      return {
        active: document.querySelector('#cockpit-section-navigation a[aria-current="location"]')?.getAttribute('href'),
        focusedToggle: document.activeElement === document.querySelector('.cockpit-nav-toggle'),
        hash: location.hash,
        navHeight: nav?.getBoundingClientRect().height,
        open: document.querySelector('#cockpit-sidebar').classList.contains('is-open'),
        top: document.querySelector('#methodo')?.getBoundingClientRect().top,
        viewportHeight: innerHeight,
      };
    })()`);
    return cockpitKeyboardMethodo.hash === "#methodo"
      && cockpitKeyboardMethodo.active === "#methodo"
      && !cockpitKeyboardMethodo.open
      && cockpitKeyboardMethodo.focusedToggle
      && cockpitKeyboardMethodo.top >= cockpitKeyboardMethodo.navHeight
      && cockpitKeyboardMethodo.top < cockpitKeyboardMethodo.viewportHeight - 40;
  }, "Cockpit keyboard #methodo");

  const portfolioPointer = await realPointerClick("document.querySelector('.portfolio-back')", "cockpit Portfolio return");
  await waitFor(() => evaluate(`location.pathname === ${JSON.stringify(publicBasePath)}`), "Portfolio return navigation");
  await waitFor(() => evaluate(`Boolean(document.querySelector('a[href$="/cases/real-estate-downside/"]'))`), "Portfolio home rendering");
  const realEstateHomeLink = await evaluate(`(() => {
    const link = document.querySelector('a[href$="/cases/real-estate-downside/"]');
    return { href: link?.href, target: link?.getAttribute('target') };
  })()`);
  assert(realEstateHomeLink.href === cockpitUrl && realEstateHomeLink.target === null, `Portfolio Real Estate link mismatch: ${JSON.stringify(realEstateHomeLink)}`);

  async function opellaState() {
    return evaluate(`(() => {
      const card = Array.from(document.querySelectorAll('.case-grid-item')).find((item) => item.textContent.includes('Opella'));
      return {
        href: card?.getAttribute('href'),
        interactiveDescendants: card?.querySelectorAll('a, button, [role="link"], [tabindex]').length,
        tag: card?.tagName,
        text: card?.innerText,
      };
    })()`);
  }

  const opellaFr = await opellaState();
  assert(opellaFr.tag === "DIV" && opellaFr.href === null && opellaFr.interactiveDescendants === 0 && /en développement/i.test(opellaFr.text), `French Opella card mismatch: ${JSON.stringify(opellaFr)}`);
  await navigate(`${portfolioUrl}?lang=en`);
  await waitFor(() => evaluate("document.documentElement.lang === 'en' && document.body.innerText.includes('Opella')"), "English Portfolio home");
  const opellaEn = await opellaState();
  assert(opellaEn.tag === "DIV" && opellaEn.href === null && opellaEn.interactiveDescendants === 0 && /in development/i.test(opellaEn.text), `English Opella card mismatch: ${JSON.stringify(opellaEn)}`);
  const englishCockpitHomePointer = await realPointerClick("Array.from(document.querySelectorAll('a')).find((link) => link.href.includes('/cases/real-estate-downside/'))", "English Portfolio Real Estate");
  await waitFor(() => evaluate("location.pathname.endsWith('/cases/real-estate-downside/') && location.search === '?lang=en' && document.documentElement.lang === 'en'"), "Portfolio EN to Cockpit EN");
  const englishPortfolioReturnPointer = await realPointerClick("document.querySelector('.portfolio-back')", "English Cockpit Portfolio return");
  await waitFor(() => evaluate(`location.pathname === ${JSON.stringify(publicBasePath)} && location.search === '?lang=en' && document.documentElement.lang === 'en'`), "Cockpit EN to Portfolio EN");
  const cockpitEnglishRoundTrip = {
    cockpitPointer: englishCockpitHomePointer,
    portfolioPointer: englishPortfolioReturnPointer,
    finalUrl: await evaluate("location.href"),
  };

  for (const resource of ["Note_synthese_cockpit.pdf", "pack/pack_comite_core_plus_france.xlsx", "deployment.json"]) {
    const response = await fetch(`${cockpitUrl}${resource}`);
    assert(response.ok, `Cockpit resource unavailable: ${resource} (${response.status})`);
  }

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
    desktopLayouts,
    removedAnchorDirect,
    mobileSummaryPointer,
    mobileSummaryOpen,
    mobileMarketPointer,
    mobileMarket,
    mobileSummaryClosed,
    peerDisclosurePointer,
    peerDisclosureOpen,
    transactionDisclosurePointer,
    transactionDisclosureOpen,
    chartDisclosureOpen,
    cockpitInitial,
    cockpitEnglishProbe,
    cockpitEnglishPercentages,
    cockpitLanguageTransitions,
    cockpitEnglishFullScan,
    cockpitWide,
    cockpitAnchorResults,
    cockpitMethodoRefresh,
    cockpitFooterGapDesktop,
    cockpitBearPointer,
    cockpitBearState,
    cockpitBasePointer,
    cockpitBaseState,
    cockpitCustomState,
    cockpitAfterRefresh,
    cockpitMobile,
    cockpitMobileLayouts,
    cockpitMenuPointer,
    cockpitMenuOpen,
    cockpitMenuEscape,
    cockpitMobileBearPointer,
    cockpitMobileBasePointer,
    cockpitToggleFocus,
    cockpitKeyboardMethodo,
    portfolioPointer,
    realEstateHomeLink,
    opellaFr,
    opellaEn,
    cockpitEnglishRoundTrip,
    responsive,
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
