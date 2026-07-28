import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createOpellaFinancials,
  opellaFinancials,
  readFinancialRegistryPath,
} from "../src/data/opellaFinancials.js";
import {
  calculateOpella,
  runOpellaFundingVector,
} from "../src/utils/opellaEngine.js";
import {
  assertClosedDirectory,
  assertFileSha256,
  assertNoUnapprovedNumericLiterals,
  assertUnique,
  readJson,
} from "./integration-manifest.mjs";
import {
  extractOpellaEngineContract,
  opellaSourceNames,
} from "./integrate-opella-case.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");
const bundleRoot = path.join(repositoryRoot, "integrations", "opella");

const close = (actual, expected, tolerance, label) => {
  assert.equal(typeof actual, "number", `${label} must be numeric`);
  assert.equal(typeof expected, "number", `${label} canonical value must be numeric`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);
};

const relationTolerance = (sourceManifest, id) => {
  const tolerance = sourceManifest.relations.find((relation) => relation.id === id)?.tolerance;
  assert.equal(typeof tolerance, "number", `${id} must declare a numeric tolerance`);
  return tolerance;
};

async function verifySourceBoundary(sourceRoot, bundleManifest, bundledEngineContract) {
  for (const source of bundleManifest.sourceFiles) {
    const relative = source.path.replace(/^Transaction Services\//, "");
    await assertFileSha256(path.join(sourceRoot, relative), source.sha256, source.path);
  }

  assert.equal(
    await readFile(path.join(sourceRoot, opellaSourceNames.snapshot), "utf8"),
    await readFile(path.join(bundleRoot, "snapshot.json"), "utf8"),
    "TS snapshot and integrated snapshot must be byte-identical",
  );
  assert.equal(
    await readFile(path.join(sourceRoot, opellaSourceNames.manifest), "utf8"),
    await readFile(path.join(bundleRoot, "source-manifest.json"), "utf8"),
    "TS manifest and integrated source manifest must be byte-identical",
  );

  const extracted = await extractOpellaEngineContract(
    path.join(sourceRoot, opellaSourceNames.generator),
  );
  assert.deepEqual(
    bundledEngineContract,
    extracted,
    "Generated engine contract must match the canonical generator constants",
  );
}

export async function runOpellaIntegrationChecks({ sourceRoot } = {}) {
  const bundleManifest = await readJson(path.join(bundleRoot, "manifest.json"));
  const snapshot = await readJson(path.join(bundleRoot, "snapshot.json"));
  const sourceManifest = await readJson(path.join(bundleRoot, "source-manifest.json"));
  const engineContract = await readJson(path.join(bundleRoot, "engine-contract.json"));
  const declaredBundleFiles = bundleManifest.bundleFiles.map(({ path: filename }) => filename);
  const engineSource = await readFile(path.join(repositoryRoot, "src", "utils", "opellaEngine.js"), "utf8");

  assertUnique(declaredBundleFiles, "Opella bundleFiles");
  assertUnique(bundleManifest.generatedFiles.map(({ path: filename }) => filename), "Opella generatedFiles");
  assertUnique(bundleManifest.sourceFiles.map(({ path: filename }) => filename), "Opella sourceFiles");
  await assertClosedDirectory(
    bundleRoot,
    ["manifest.json", ...declaredBundleFiles],
    "Opella integration bundle",
  );
  for (const file of bundleManifest.bundleFiles) {
    const expectedMime = file.path === ".gitattributes" ? "text/plain" : "application/json";
    assert.equal(file.mime, expectedMime, `${file.path} has an unexpected bundle MIME`);
    await assertFileSha256(path.join(bundleRoot, file.path), file.sha256, `bundle ${file.path}`);
  }
  assert.deepEqual(bundleManifest.downloads, []);
  assert.deepEqual(bundleManifest.presentationFiles, []);
  assert.deepEqual(bundleManifest.allowedNonFinancialLiterals, []);
  assert.deepEqual(bundleManifest.requiredPublicMessages.fr, []);
  assert.deepEqual(bundleManifest.requiredPublicMessages.en, []);
  assert.deepEqual(bundleManifest.forbiddenPublicTerms.fr, []);
  assert.deepEqual(bundleManifest.forbiddenPublicTerms.en, []);
  assert.deepEqual(
    bundleManifest.generatedFiles.map(({ path: filename }) => filename).sort(),
    declaredBundleFiles.sort(),
  );
  assert.ok(bundleManifest.bundleFiles.every(({ role }) => Boolean(role)));
  assert.ok(bundleManifest.generatedFiles.every(({ role, generatedBy }) => Boolean(role && generatedBy)));
  assert.ok(Object.values(bundleManifest.publicExposure).every((value) => value === false));
  assert.equal(bundleManifest.financialRegistryFields.count, sourceManifest.financialRegistryFields.length);
  assert.equal(bundleManifest.formulas.count, sourceManifest.relations.length);
  assert.equal(bundleManifest.fundingVectors.normativeCount, sourceManifest.fundingVectors.normative.length);
  assert.equal(
    bundleManifest.fundingVectors.falsificationCount,
    sourceManifest.fundingVectors.falsification.length,
  );
  assert.equal(
    bundleManifest.fundingVectors.coverageCount,
    sourceManifest.fundingVectors.coverage.vectors.length,
  );
  assert.equal(bundleManifest.scenarios.leverCount, sourceManifest.scenarioLevers.length);
  assert.equal(bundleManifest.snapshotIdentity.bundle, "snapshot.json");
  assert.equal(
    bundleManifest.snapshotIdentity.sha256,
    sourceManifest.sourceFiles[opellaSourceNames.snapshot],
  );
  assert.equal(
    engineContract.generatedFromSha256,
    sourceManifest.sourceFiles[opellaSourceNames.generator],
  );
  assert.doesNotMatch(engineSource, /from\s+["'][^"']*(?:dcfEngine|SidetradeScenario|react)/i);
  assert.doesNotMatch(engineSource, /\b(?:document|window)\./);

  const registry = createOpellaFinancials(snapshot, {
    sourceManifestInput: sourceManifest,
    bundleManifestInput: bundleManifest,
    engineContractInput: engineContract,
  });
  assert.deepEqual(registry.metadata.sources, snapshot.sources);
  assert.deepEqual(registry.metadata.lineage, snapshot.lineage);
  assert.deepEqual(registry.metadata.calendar, snapshot.calendar);
  assert.equal(registry.display.currency, snapshot.currency);
  assert.equal(registry.display.unit, snapshot.unit);
  assert.equal(registry.translation.carriesFinancialValues, false);
  for (const field of sourceManifest.financialRegistryFields) {
    assert.deepEqual(
      readFinancialRegistryPath(registry.snapshot, field),
      readFinancialRegistryPath(snapshot, field),
      `snapshot -> registry exact equality failed for ${field}`,
    );
  }

  const tolerance = relationTolerance(sourceManifest, "R-FUNDING-CUM");
  const base = calculateOpella(registry);
  close(base.outputs["O-RUNRATE"].value, snapshot.outputs["O-RUNRATE"].value, tolerance, "O-RUNRATE");
  close(base.outputs["O-SEPCOST"].value, snapshot.outputs["O-SEPCOST"].value, tolerance, "O-SEPCOST");
  close(base.outputs["O-PEAK"].value, snapshot.outputs["O-PEAK"].value, tolerance, "O-PEAK");
  assert.equal(base.outputs["O-PEAK"].period, snapshot.outputs["O-PEAK"].period);
  assert.equal(base.outputs["O-STEADY"].value, snapshot.outputs["O-STEADY"].value);
  assert.equal(base.outputs["O-RESORB"].state, snapshot.outputs["O-RESORB"].state);
  close(base.modules.m1.entryMultiple, snapshot.m1.entryMultiple.value, tolerance, "R-MULT");
  close(base.modules.m3.runRateTotal, snapshot.m3.runRateTotal, tolerance, "R-STANDALONE");
  close(
    base.modules.m6.standaloneRunRate,
    snapshot.m6.standaloneRunRate.value,
    tolerance,
    "m6.standaloneRunRate",
  );
  for (const period of snapshot.calendar.horizon) {
    close(base.modules.m3.byPeriod[period], snapshot.m3.byPeriod[period], tolerance, `m3.${period}`);
    close(base.modules.m4.byPeriod[period], snapshot.m4.byPeriod[period], tolerance, `m4.${period}`);
    close(base.modules.m5.byPeriod[period], snapshot.m5.byPeriod[period], tolerance, `m5.${period}`);
    close(base.modules.m6.cash[period], snapshot.m6.cash[period], tolerance, `m6.${period}`);
  }
  const separationComponents = base.modules.m7.inventory
    .filter(({ group, id }) => group === "L-M4" || group === "L-M5" || id === "L-SEPCAPEX")
    .map(({ id }) => id)
    .sort();
  assert.deepEqual(separationComponents, [...snapshot.outputs["O-SEPCOST"].components].sort());
  assert.ok(snapshot.outputs["O-SEPCOST"].excludes.every(
    (id) => !separationComponents.includes(id),
  ));

  for (const expected of snapshot.m7.periods) {
    const actual = base.modules.m7.periods.find(({ period }) => period === expected.period);
    assert.ok(actual, `engine period ${expected.period} is required`);
    for (const field of ["c", "s", "sCum", "need", "eGap", "nOneOff"]) {
      close(actual[field], expected[field], tolerance, `base ${expected.period}.${field}`);
    }
  }
  assert.equal(base.modules.m7.resorb.pk, undefined, "current-state Pk must remain truly absent");

  for (const vector of sourceManifest.fundingVectors.normative) {
    const actual = runOpellaFundingVector(vector.E, vector.N, tolerance);
    assert.equal(actual.resorb.state, vector.state, `${vector.id} state`);
    assert.equal(actual.resorb.pk ?? null, vector.pk, `${vector.id} Pk`);
    close(actual.peak.amount, vector.peak, tolerance, `${vector.id} peak`);
    assert.equal(actual.peak.period, vector.peakPeriod, `${vector.id} peak period`);
    if ("residualSurplus" in vector) {
      close(
        actual.horizon.residualSurplus,
        vector.residualSurplus,
        tolerance,
        `${vector.id} residual surplus`,
      );
    }
    const final = actual.periods.at(-1);
    close(final.s, vector.E.at(-1) + vector.N.at(-1), tolerance, `${vector.id} Δ_H = E_H + N_H`);
  }

  const scenarioResults = {};
  let scenarioStateCount = 0;
  for (const lever of sourceManifest.scenarioLevers) {
    scenarioResults[lever.id] = {};
    for (const state of lever.states) {
      const actual = calculateOpella(registry, { [lever.id]: state });
      const expected = snapshot.scenarios[lever.id].states[state];
      close(actual.outputs["O-RUNRATE"].value, expected.runRate, tolerance, `${lever.id}/${state}.runRate`);
      close(actual.outputs["O-SEPCOST"].value, expected.sepCost, tolerance, `${lever.id}/${state}.sepCost`);
      close(actual.outputs["O-PEAK"].value, expected.peak, tolerance, `${lever.id}/${state}.peak`);
      assert.equal(actual.outputs["O-PEAK"].period, expected.peakPeriod, `${lever.id}/${state}.peakPeriod`);
      assert.equal(actual.outputs["O-STEADY"].value, expected.steady, `${lever.id}/${state}.steady`);
      assert.equal(actual.outputs["O-RESORB"].state, expected.resorbState, `${lever.id}/${state}.resorbState`);
      assert.equal(actual.calendar.maxHorizon, expected.maxHorizon, `${lever.id}/${state}.maxHorizon`);
      scenarioResults[lever.id][state] = actual;
      scenarioStateCount += 1;
    }
  }

  for (const leverId of sourceManifest.scenarioInvariant.levers) {
    const states = sourceManifest.scenarioLevers.find(({ id }) => id === leverId).states;
    const results = states.map((state) => scenarioResults[leverId][state].outputs);
    assert.ok(results.every((output, index) => (
      index === 0
      || (
        output["O-SEPCOST"].value + tolerance >= results[index - 1]["O-SEPCOST"].value
        && output["O-PEAK"].value + tolerance >= results[index - 1]["O-PEAK"].value
      )
    )), `${leverId} must preserve increasing scenario invariants`);
  }

  const missing = structuredClone(snapshot);
  delete missing.m1.revenue;
  assert.throws(
    () => createOpellaFinancials(missing),
    ({ code }) => code === "OP-REGISTRY-REQUIRED",
    "OP-REGISTRY-REQUIRED must intercept a missing financial field",
  );

  const duplicate = structuredClone(snapshot);
  duplicate.sources.push(structuredClone(duplicate.sources[0]));
  assert.throws(
    () => createOpellaFinancials(duplicate),
    ({ code }) => code === "OP-REGISTRY-DUPLICATE",
    "OP-REGISTRY-DUPLICATE must intercept a duplicated structural id",
  );

  const changed = structuredClone(snapshot);
  changed.outputs["O-RESORB"].state = sourceManifest.fundingVectors.normative.find(
    ({ state }) => state !== changed.m7.resorb.state,
  ).state;
  assert.throws(
    () => createOpellaFinancials(changed),
    ({ code }) => code === "OP-REGISTRY-CARRIER",
    "OP-REGISTRY-CARRIER must intercept a modified canonical state",
  );

  const zeroDenominator = structuredClone(snapshot);
  zeroDenominator.m1.margin.value = 0;
  assert.throws(
    () => calculateOpella(createOpellaFinancials(zeroDenominator)),
    ({ code }) => code === "OP-ENGINE-DIVISION",
    "OP-ENGINE-DIVISION must reject a zero denominator",
  );

  const invalidSign = structuredClone(snapshot);
  invalidSign.m3.functions[0].runRate = Math.abs(invalidSign.m3.functions[0].runRate);
  assert.throws(
    () => calculateOpella(createOpellaFinancials(invalidSign)),
    ({ code }) => code === "OP-ENGINE-SIGN",
    "OP-ENGINE-SIGN must reject an accounting charge with a positive sign",
  );

  assert.throws(
    () => calculateOpella(opellaFinancials, { "S-COST": "invalid" }),
    ({ code }) => code === "OP-ENGINE-STATE",
    "OP-ENGINE-STATE must reject an unknown lever state",
  );

  const approvedLiterals = new Set(
    bundleManifest.literalPolicy.allowedNumericLiterals.map(({ value }) => value),
  );
  for (const filename of bundleManifest.literalPolicy.scannedFiles) {
    await assertNoUnapprovedNumericLiterals(
      path.join(repositoryRoot, filename),
      approvedLiterals,
      filename,
    );
  }

  if (sourceRoot) {
    await verifySourceBoundary(path.resolve(sourceRoot), bundleManifest, engineContract);
  }

  console.log(
    `Opella inactive integration: closed bundle, ${sourceManifest.fundingVectors.normative.length} vectors and ${scenarioStateCount} scenario states reconciled`,
  );
}

if (path.resolve(process.argv[1] ?? "") === scriptPath) {
  const sourceFlag = process.argv.indexOf("--source");
  const sourceRoot = sourceFlag >= 0 ? process.argv[sourceFlag + 1] : undefined;
  await runOpellaIntegrationChecks({ sourceRoot });
}
