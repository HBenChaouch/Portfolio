const port = Number(process.env.S12_CDP_PORT || 9229);
const base = process.env.S12_BASE_URL || "http://127.0.0.1:4192/cases/sidetrade-valuation/analysis/";

const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 0;
const pending = new Map();
const browserMessages = [];
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

function command(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function navigate(url) {
  await command("Page.navigate", { url });
  await delay(900);
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await command("Page.enable");
await command("Runtime.enable");
await command("Log.enable");
await command("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

await navigate(`${base}#dcf`);
const direct = await evaluate(`({
  hash: location.hash,
  active: document.querySelector('[aria-current="location"]')?.getAttribute('href'),
  top: document.querySelector('#dcf')?.getBoundingClientRect().top
})`);
assert(direct.hash === "#dcf" && direct.active?.endsWith("#dcf"), `Direct DCF state mismatch: ${JSON.stringify(direct)}`);

await evaluate(`window.scrollTo({ top: window.scrollY + document.querySelector('#trading').getBoundingClientRect().top - 103, behavior: 'instant' })`);
await delay(600);
const scrolled = await evaluate(`({
  url: location.href,
  hash: location.hash,
  active: document.querySelector('[aria-current="location"]')?.getAttribute('href'),
  top: document.querySelector('#trading')?.getBoundingClientRect().top
})`);
assert(scrolled.hash === "#trading" && scrolled.active?.endsWith("#trading"), `Scroll spy mismatch: ${JSON.stringify(scrolled)}`);
assert(Math.abs(scrolled.top - 103) < 3, `Trading alignment mismatch: ${JSON.stringify(scrolled)}`);

await evaluate(`document.querySelector('a[href$="#football"]').click()`);
await delay(1800);
const footballFr = await evaluate(`({
  hash: location.hash,
  active: document.querySelector('[aria-current="location"]')?.getAttribute('href'),
  top: document.querySelector('#football')?.getBoundingClientRect().top,
  lang: document.documentElement.lang
})`);
assert(footballFr.hash === "#football" && footballFr.active?.endsWith("#football"), `Football FR mismatch: ${JSON.stringify(footballFr)}`);

await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'EN').click()`);
await delay(700);
const footballEn = await evaluate(`({
  url: location.href,
  hash: location.hash,
  active: document.querySelector('[aria-current="location"]')?.getAttribute('href'),
  top: document.querySelector('#football')?.getBoundingClientRect().top,
  lang: document.documentElement.lang
})`);
assert(footballEn.lang === "en" && footballEn.hash === "#football" && footballEn.active?.endsWith("#football"), `Football EN mismatch: ${JSON.stringify(footballEn)}`);
await delay(1000);
const footballEnStable = await evaluate(`({
  url: location.href,
  hash: location.hash,
  active: document.querySelector('[aria-current="location"]')?.getAttribute('href'),
  top: document.querySelector('#football')?.getBoundingClientRect().top,
  lang: document.documentElement.lang
})`);
assert(footballEnStable.lang === "en" && footballEnStable.hash === "#football" && footballEnStable.active?.endsWith("#football"), `Football EN after reflow mismatch: ${JSON.stringify(footballEnStable)}`);
assert(Math.abs(footballEnStable.top - 104) < 3, `Football EN stable alignment mismatch: ${JSON.stringify(footballEnStable)}`);

await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await navigate(base);
const mobileInitial = await evaluate(`({
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  portfolio: Array.from(document.querySelectorAll('a')).some((a) => a.textContent.includes('Portfolio')),
  summary: Array.from(document.querySelectorAll('button')).some((b) => b.textContent.includes('Sommaire'))
})`);
assert(mobileInitial.overflow === 0 && mobileInitial.portfolio && mobileInitial.summary, `Mobile initial mismatch: ${JSON.stringify(mobileInitial)}`);

await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.includes('Sommaire')).click()`);
await delay(150);
await evaluate(`document.querySelector('a[href$="#dcf"]').click()`);
await delay(700);
const mobileDcf = await evaluate(`({
  hash: location.hash,
  active: document.querySelector('[aria-current="location"]')?.getAttribute('href'),
  summaryExpanded: Array.from(document.querySelectorAll('button')).find((button) => button.textContent.includes('Sommaire'))?.getAttribute('aria-expanded'),
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
})`);
assert(mobileDcf.hash === "#dcf" && mobileDcf.active?.endsWith("#dcf") && mobileDcf.summaryExpanded === "false" && mobileDcf.overflow === 0, `Mobile DCF mismatch: ${JSON.stringify(mobileDcf)}`);

await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'EN').click()`);
await delay(700);
const mobileEn = await evaluate(`({ url: location.href, hash: location.hash, lang: document.documentElement.lang, active: document.querySelector('[aria-current="location"]')?.getAttribute('href') })`);
assert(mobileEn.lang === "en" && mobileEn.hash === "#dcf" && mobileEn.active?.endsWith("#dcf"), `Mobile language mismatch: ${JSON.stringify(mobileEn)}`);
await delay(1000);
const mobileEnStable = await evaluate(`({
  url: location.href,
  hash: location.hash,
  lang: document.documentElement.lang,
  active: document.querySelector('[aria-current="location"]')?.getAttribute('href'),
  top: document.querySelector('#dcf')?.getBoundingClientRect().top,
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
})`);
assert(mobileEnStable.lang === "en" && mobileEnStable.hash === "#dcf" && mobileEnStable.active?.endsWith("#dcf"), `Mobile language after reflow mismatch: ${JSON.stringify(mobileEnStable)}`);
assert(Math.abs(mobileEnStable.top - 124) < 3 && mobileEnStable.overflow === 0, `Mobile DCF stable alignment mismatch: ${JSON.stringify(mobileEnStable)}`);

await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Bull').click()`);
await delay(200);
const bull = await evaluate(`({ pressed: Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Bull')?.getAttribute('aria-pressed'), has497: document.body.innerText.includes('€497m') })`);
assert(bull.pressed === "true" && bull.has497, `Mobile Bull mismatch: ${JSON.stringify(bull)}`);
await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Base').click()`);
await delay(200);
const baseScenario = await evaluate(`({ pressed: Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Base')?.getAttribute('aria-pressed'), has301: document.body.innerText.includes('€301m') })`);
assert(baseScenario.pressed === "true" && baseScenario.has301, `Mobile Base mismatch: ${JSON.stringify(baseScenario)}`);

assert(browserMessages.length === 0, `Browser warnings/errors: ${browserMessages.join(" | ")}`);
console.log("Navigation browser behavior: PASS");
console.log(JSON.stringify({ direct, scrolled, footballFr, footballEn, footballEnStable, mobileInitial, mobileDcf, mobileEn, mobileEnStable, bull, baseScenario, browserMessages }, null, 2));
await command("Target.closeTarget", { targetId: target.id });
socket.close();
