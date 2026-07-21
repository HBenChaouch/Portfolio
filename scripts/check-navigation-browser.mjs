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
  if (filename.endsWith(".pdf")) return "application/pdf";
  if (filename.endsWith(".woff2")) return "font/woff2";
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
      const marker = document.querySelector('.ff-row .row-reference.' + kind).getBoundingClientRect();
      const markerElement = document.querySelector('.ff-row .row-reference.' + kind);
      const label = document.querySelector('.ff-reference-scale .ref-label.' + kind).getBoundingClientRect();
      const expectedX = scale.left + parseFloat(markerElement.style.left) / 100 * scale.width;
      return { alignmentError: Math.abs(marker.left - expectedX), kind, labelX: label.left + label.width / 2, markerX: marker.left, onScale: marker.left >= scale.left - 1 && marker.left <= scale.right + 1 };
    });
    const disclosureTargets = Array.from(document.querySelectorAll('.chart-disclosures summary, .transaction-cards summary, .peer-table .tip > summary'))
      .filter((element) => getComputedStyle(element).display !== 'none')
      .map((element) => element.getBoundingClientRect().height);
    return {
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      offenders: innerWidth <= 760 ? offenders : [],
      labelsOverlap: overlap,
      references,
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

  const desktopLayouts = [];
  for (const viewport of [[1280, 720], [1920, 1080]]) {
    const state = await responsiveState(...viewport, false);
    assert(state.documentOverflow === 0, `Desktop document overflow at ${viewport.join("x")}: ${JSON.stringify(state)}`);
    assert(!state.labelsOverlap, `Desktop football labels overlap at ${viewport.join("x")}: ${JSON.stringify(state)}`);
    assert(state.references.every((reference) => reference.onScale && reference.alignmentError < 1), `Desktop football scale mismatch at ${viewport.join("x")}: ${JSON.stringify(state.references)}`);
    desktopLayouts.push(state);
  }

  const responsive = [];
  for (const viewport of [[360, 800], [390, 844], [430, 932]]) {
    const state = await responsiveState(...viewport);
    assert(state.documentOverflow === 0, `Document overflow at ${viewport.join("x")}: ${JSON.stringify(state)}`);
    assert(state.offenders.length === 0, `Horizontal narration overflow at ${viewport.join("x")}: ${JSON.stringify(state.offenders)}`);
    assert(!state.labelsOverlap, `Football labels overlap at ${viewport.join("x")}: ${JSON.stringify(state)}`);
    assert(state.references.every((reference) => reference.onScale && reference.alignmentError < 1), `Football reference outside common scale at ${viewport.join("x")}: ${JSON.stringify(state.references)}`);
    assert(state.minDisclosureTarget >= 44, `Disclosure target below 44px at ${viewport.join("x")}: ${state.minDisclosureTarget}`);
    assert(state.transactionCards === "grid" && state.verticalWaterfall === "grid", `Mobile representations missing at ${viewport.join("x")}: ${JSON.stringify(state)}`);
    responsive.push(state);
  }

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
  const cockpitUrl = `http://127.0.0.1:${webPort}/cases/real-estate-downside/`;
  await navigate(cockpitUrl);
  await waitFor(() => evaluate("Boolean(window.__COCKPIT__?.runSelfTests)"), "Real Estate cockpit initialization");
  const cockpitInitial = await evaluate(`(() => {
    const tests = window.__COCKPIT__.runSelfTests();
    const back = document.querySelector('.portfolio-back');
    return {
      backHref: back?.href,
      backTarget: back?.getAttribute('target'),
      downloads: Array.from(document.querySelectorAll('.dl-card')).map((link) => ({
        download: link.hasAttribute('download') || link.id === 'dl-csv',
        href: link.getAttribute('href'),
        target: link.getAttribute('target'),
      })),
      oldDomainPresent: document.documentElement.innerHTML.includes('hbenchaouch.github.io/cockpit-fund-controlling'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      passed: tests.passed,
      total: tests.total,
      title: document.title,
    };
  })()`);
  assert(cockpitInitial.passed === 13 && cockpitInitial.total === 13, `Cockpit self-tests mismatch: ${JSON.stringify(cockpitInitial)}`);
  assert(cockpitInitial.backHref === `http://127.0.0.1:${webPort}/` && cockpitInitial.backTarget === null, `Cockpit return mismatch: ${JSON.stringify(cockpitInitial)}`);
  assert(cockpitInitial.downloads.length === 3 && cockpitInitial.downloads.every((link) => link.download && link.target === null), `Cockpit downloads mismatch: ${JSON.stringify(cockpitInitial.downloads)}`);
  assert(!cockpitInitial.oldDomainPresent && cockpitInitial.overflow === 0, `Cockpit public integration mismatch: ${JSON.stringify(cockpitInitial)}`);

  await command("Input.dispatchKeyEvent", { key: "b", code: "KeyB", type: "keyDown", windowsVirtualKeyCode: 66 });
  await command("Input.dispatchKeyEvent", { key: "b", code: "KeyB", type: "keyUp", windowsVirtualKeyCode: 66 });
  await waitFor(() => evaluate("window.__COCKPIT__.state?.globalStatus === 'red'"), "cockpit Bear interaction");
  await command("Input.dispatchKeyEvent", { key: "r", code: "KeyR", type: "keyDown", windowsVirtualKeyCode: 82 });
  await command("Input.dispatchKeyEvent", { key: "r", code: "KeyR", type: "keyUp", windowsVirtualKeyCode: 82 });
  await waitFor(() => evaluate("window.__COCKPIT__.state?.globalStatus === 'green'"), "cockpit reset interaction");

  await command("Page.reload", { ignoreCache: true });
  await waitFor(() => evaluate("document.readyState === 'complete' && Boolean(window.__COCKPIT__?.runSelfTests)"), "cockpit direct refresh");
  const cockpitAfterRefresh = await evaluate("(() => { const tests = window.__COCKPIT__.runSelfTests(); return { href: location.href, passed: tests.passed, total: tests.total }; })()");
  assert(cockpitAfterRefresh.href === cockpitUrl && cockpitAfterRefresh.passed === 13 && cockpitAfterRefresh.total === 13, `Cockpit refresh mismatch: ${JSON.stringify(cockpitAfterRefresh)}`);

  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await command("Page.reload", { ignoreCache: true });
  await waitFor(() => evaluate("document.readyState === 'complete' && Boolean(window.__COCKPIT__?.runSelfTests)"), "mobile cockpit refresh");
  const cockpitMobile = await evaluate(`(() => {
    const back = document.querySelector('.portfolio-back').getBoundingClientRect();
    const tests = window.__COCKPIT__.runSelfTests();
    return {
      backHeight: back.height,
      backVisible: back.top >= 0 && back.bottom <= innerHeight,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      passed: tests.passed,
      total: tests.total,
    };
  })()`);
  assert(cockpitMobile.overflow === 0 && cockpitMobile.backVisible && cockpitMobile.backHeight >= 44 && cockpitMobile.passed === 13 && cockpitMobile.total === 13, `Mobile cockpit mismatch: ${JSON.stringify(cockpitMobile)}`);

  const portfolioPointer = await realPointerClick("document.querySelector('.portfolio-back')", "cockpit Portfolio return");
  await waitFor(() => evaluate(`location.pathname === '/'`), "Portfolio return navigation");
  await waitFor(() => evaluate(`Boolean(document.querySelector('a[href$="/cases/real-estate-downside/"]'))`), "Portfolio home rendering");
  const realEstateHomeLink = await evaluate(`(() => {
    const link = document.querySelector('a[href$="/cases/real-estate-downside/"]');
    return { href: link?.href, target: link?.getAttribute('target') };
  })()`);
  assert(realEstateHomeLink.href === cockpitUrl && realEstateHomeLink.target === null, `Portfolio Real Estate link mismatch: ${JSON.stringify(realEstateHomeLink)}`);

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
    peerDisclosurePointer,
    peerDisclosureOpen,
    transactionDisclosurePointer,
    transactionDisclosureOpen,
    chartDisclosureOpen,
    cockpitInitial,
    cockpitAfterRefresh,
    cockpitMobile,
    portfolioPointer,
    realEstateHomeLink,
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
