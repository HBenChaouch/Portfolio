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
  serializeOpellaEngineContract,
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

class OpellaRelationFailure extends Error {
  constructor(relation, message) {
    super(`${relation}: ${message}`);
    this.name = "OpellaRelationFailure";
    this.relation = relation;
  }
}

const requireRelation = (condition, relation, message) => {
  if (!condition) {
    throw new OpellaRelationFailure(relation, message);
  }
};

const contributionAt = (line, period) => (
  line.contribution?.[period]
  ?? (line.side === "cas" ? -line.amounts[period] : line.amounts[period])
);

const relationChecks = {
  "R-QUAL": (candidate, tolerance) => {
    const horizon = candidate.calendar.horizon;
    const forcedQualifications = {
      "L-M3": "récurrent",
      "L-M4": "ponctuel",
      "L-M5": "ponctuel",
      "L-M6SEP": "ponctuel",
    };
    for (const line of candidate.m7.inventory) {
      requireRelation(
        ["récurrent", "ponctuel"].includes(line.qualification),
        "R-QUAL",
        `${line.id} must declare exactly one accepted qualification`,
      );
      const forced = forcedQualifications[line.group];
      requireRelation(
        !forced || line.qualification === forced,
        "R-QUAL",
        `${line.id} qualification contradicts group ${line.group}`,
      );
      requireRelation(
        horizon.includes(line.start),
        "R-QUAL",
        `${line.id} start must belong to the modeled horizon`,
      );
      const startIndex = horizon.indexOf(line.start);
      if (line.qualification === "récurrent") {
        requireRelation(
          line.declaredEnd === null,
          "R-QUAL",
          `${line.id} recurring line must not declare an end inside the horizon`,
        );
        requireRelation(
          horizon.slice(startIndex).every((period) => period in line.amounts),
          "R-QUAL",
          `${line.id} recurring footprint must cover the horizon from its start`,
        );
      } else {
        requireRelation(
          horizon.includes(line.declaredEnd),
          "R-QUAL",
          `${line.id} one-off end must belong to the modeled horizon`,
        );
        const endIndex = horizon.indexOf(line.declaredEnd);
        requireRelation(
          horizon.slice(endIndex + 1).every(
            (period) => Math.abs(line.amounts[period] ?? 0) <= tolerance,
          ),
          "R-QUAL",
          `${line.id} one-off footprint continues after its declared end`,
        );
      }
    }
  },
  "R-CF": (candidate, tolerance) => {
    for (const period of candidate.calendar.horizon) {
      const counterfactualLines = candidate.m7.inventory.filter(
        ({ side }) => side === "contrefactuel",
      );
      const lineTotal = counterfactualLines.reduce(
        (total, line) => total + line.amounts[period],
        0,
      );
      requireRelation(
        Math.abs(lineTotal - candidate.m7.counterfactual.cash[period]) <= tolerance,
        "R-CF",
        `${period} counterfactual cash differs from the sum of its lines`,
      );
    }
  },
  "R-EGAP": (candidate, tolerance) => {
    for (const row of candidate.m7.periods) {
      const expected = candidate.m7.inventory
        .filter(({ qualification }) => qualification === "récurrent")
        .reduce((total, line) => total + contributionAt(line, row.period), 0);
      requireRelation(
        Math.abs(expected - row.eGap) <= tolerance,
        "R-EGAP",
        `${row.period} eGap differs from the direct recurring-line sum`,
      );
    }
  },
  "R-NPONC": (candidate, tolerance) => {
    for (const row of candidate.m7.periods) {
      const expected = candidate.m7.inventory
        .filter(({ qualification }) => qualification === "ponctuel")
        .reduce((total, line) => total + contributionAt(line, row.period), 0);
      requireRelation(
        Math.abs(expected - row.nOneOff) <= tolerance,
        "R-NPONC",
        `${row.period} nOneOff differs from the direct one-off-line sum`,
      );
    }
  },
  "R-RECUR": (candidate, tolerance) => {
    const lineKeys = candidate.m7.inventory.map(({ id, side }) => `${id}|${side}`);
    requireRelation(
      new Set(lineKeys).size === lineKeys.length,
      "R-RECUR",
      "the recurring and one-off subsets must be disjoint",
    );
    for (const row of candidate.m7.periods) {
      requireRelation(
        Math.abs(row.s - row.eGap - row.nOneOff) <= tolerance,
        "R-RECUR",
        `${row.period} does not satisfy s = E + N`,
      );
    }
  },
  "R-FUNDING-CUM": (candidate, tolerance) => {
    let cumulative = 0;
    for (const row of candidate.m7.periods) {
      cumulative += row.s;
      requireRelation(
        Math.abs(row.s + row.c) <= tolerance,
        "R-FUNDING-CUM",
        `${row.period} does not satisfy s = -c`,
      );
      requireRelation(
        Math.abs(row.sCum - cumulative) <= tolerance,
        "R-FUNDING-CUM",
        `${row.period} cumulative balance is not memorized from origin`,
      );
      requireRelation(
        Math.abs(row.need - Math.max(0, cumulative)) <= tolerance,
        "R-FUNDING-CUM",
        `${row.period} need is not the single clipping of cumulative balance`,
      );
    }
  },
};

function executeOpellaFalsifications(snapshot, sourceManifest, tolerance) {
  const normative = sourceManifest.fundingVectors.normative;
  const injectors = {
    X1: (candidate) => {
      delete candidate.m7.inventory[0].qualification;
      return candidate;
    },
    X2: (candidate) => {
      const recurring = candidate.m7.inventory.find(
        ({ qualification }) => qualification === "récurrent",
      );
      recurring.declaredEnd = candidate.calendar.horizon[0];
      return candidate;
    },
    X3: (candidate) => {
      const oneOff = candidate.m7.inventory.find(
        ({ qualification }) => qualification === "ponctuel",
      );
      oneOff.declaredEnd = "P-outside-horizon";
      for (const period of candidate.calendar.horizon) {
        oneOff.amounts[period] = -1;
        oneOff.contribution[period] = 1;
      }
      return candidate;
    },
    X4: (candidate) => {
      const values = candidate.m7.periods.map(({ eGap }) => eGap);
      candidate.m7.periods.forEach((row, index) => {
        row.eGap = values[(index + values.length - 1) % values.length];
      });
      return candidate;
    },
    X5: (candidate) => {
      const perturbation = tolerance + tolerance;
      for (const row of candidate.m7.periods) {
        row.eGap += perturbation;
        row.nOneOff = row.s - row.eGap;
        assert.ok(
          Math.abs(row.s - row.eGap - row.nOneOff) <= tolerance,
          "X5 residual mutant must preserve s = E + N while falsifying direct N",
        );
      }
      return candidate;
    },
    X6: (candidate) => {
      const original = candidate.m7.inventory.find(
        ({ qualification }) => ["récurrent", "ponctuel"].includes(qualification),
      );
      assert.ok(original, "X6 requires a qualified M7 inventory line");
      const copy = structuredClone(original);
      copy.qualification = original.qualification === "récurrent" ? "ponctuel" : "récurrent";
      const originalKey = `${original.id}|${original.side}`;
      const copyKey = `${copy.id}|${copy.side}`;
      assert.equal(copyKey, originalKey, "X6 requires the same id|side logical key");
      assert.deepEqual(
        [original.qualification, copy.qualification].sort(),
        ["ponctuel", "récurrent"],
        "X6 requires opposite recurring and one-off qualifications",
      );
      candidate.m7.inventory.push(copy);
      console.log(
        `Opella G2 X6 non-disjoint partition: ${originalKey} is both ${original.qualification} and ${copy.qualification}`,
      );
      return candidate;
    },
    X7: (candidate) => {
      const horizonEnd = candidate.calendar.horizon.at(-1);
      candidate.m7.counterfactual.cash[horizonEnd] += tolerance + tolerance;
      return candidate;
    },
    X8: (candidate) => {
      const vector = normative.find(({ id }) => id === "V9");
      assert.ok(vector, "X8 requires normative vector V9");
      const result = runOpellaFundingVector(vector.E, vector.N, tolerance);
      candidate.calendar.horizon = result.periods.map(({ period }) => period);
      candidate.m7.periods = structuredClone(result.periods);
      let previousNeed = 0;
      for (const row of candidate.m7.periods) {
        previousNeed = Math.max(0, previousNeed + row.s);
        row.need = previousNeed;
      }
      assert.ok(
        candidate.m7.periods.some(
          (row, index) => Math.abs(row.need - result.periods[index].need) > tolerance,
        ),
        "X8 requires V9 to distinguish period clipping from memorized cumulative clipping",
      );
      return candidate;
    },
  };

  const declared = sourceManifest.fundingVectors.falsification;
  const declaredIds = declared.map(({ id }) => id);
  assertUnique(declaredIds, "Opella falsification vectors");
  assert.deepEqual(
    Object.keys(injectors).sort(),
    [...declaredIds].sort(),
    "Every declared falsification vector must have exactly one executable injector",
  );
  for (const relation of new Set(declared.map(({ relation: id }) => id))) {
    relationChecks[relation](snapshot, tolerance);
  }

  const executed = new Set();
  for (const vector of declared) {
    const check = relationChecks[vector.relation];
    assert.equal(
      typeof check,
      "function",
      `${vector.id} must name an executable relation check for ${vector.relation}`,
    );
    const candidate = injectors[vector.id](structuredClone(snapshot));
    assert.throws(
      () => check(candidate, tolerance),
      (error) => error instanceof OpellaRelationFailure && error.relation === vector.relation,
      `${vector.id} must be intercepted by ${vector.relation}`,
    );
    executed.add(vector.id);
  }

  assert.deepEqual(
    [...executed].sort(),
    [...declaredIds].sort(),
    "A declared falsification vector was not executed",
  );
  return executed.size;
}

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

  const generator = path.join(sourceRoot, opellaSourceNames.generator);
  const withoutPythonUtf8 = { ...process.env };
  delete withoutPythonUtf8.PYTHONUTF8;
  const extracted = await extractOpellaEngineContract(generator, {
    environment: withoutPythonUtf8,
  });
  const extractedWithPythonUtf8 = await extractOpellaEngineContract(generator, {
    environment: {
      ...withoutPythonUtf8,
      PYTHONUTF8: "1",
    },
  });
  const ambientBytes = Buffer.from(serializeOpellaEngineContract(extracted), "utf8");
  const pythonUtf8Bytes = Buffer.from(
    serializeOpellaEngineContract(extractedWithPythonUtf8),
    "utf8",
  );
  assert.deepEqual(
    ambientBytes,
    pythonUtf8Bytes,
    "Engine contract extraction must be byte-identical with and without PYTHONUTF8=1",
  );
  assert.doesNotMatch(
    ambientBytes.toString("utf8"),
    /\uFFFD/,
    "Extracted engine contract must not contain U+FFFD",
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
  const engineContractText = await readFile(path.join(bundleRoot, "engine-contract.json"), "utf8");
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
  assert.equal(bundleManifest.pass, "O2-E");
  assert.equal(
    bundleManifest.sourceBaseline.commit,
    "8ad69b3152d237116e164cc5b4fdffd49b15308b",
  );
  assert.deepEqual(bundleManifest.presentationFiles, [
    "src/App.jsx",
    "src/components/OpellaCaseShell.jsx",
    "src/context/OpellaScenarioContext.jsx",
    "src/data/opellaCase.js",
    "src/routes/OpellaAnalysisView.jsx",
  ]);
  assert.ok(bundleManifest.allowedNonFinancialLiterals.length > 0);
  assert.equal(bundleManifest.requiredPublicMessages.status, "implemented");
  assert.equal(bundleManifest.requiredPublicMessages.fr.length, bundleManifest.requiredPublicMessages.en.length);
  assert.equal(bundleManifest.forbiddenPublicTerms.status, "implemented");
  assert.ok(bundleManifest.forbiddenPublicTerms.fr.includes("MOIC"));
  assert.ok(bundleManifest.forbiddenPublicTerms.en.includes("IRR"));
  assert.deepEqual(
    bundleManifest.generatedFiles.map(({ path: filename }) => filename).sort(),
    declaredBundleFiles.sort(),
  );
  assert.ok(bundleManifest.bundleFiles.every(({ role }) => Boolean(role)));
  assert.ok(bundleManifest.generatedFiles.every(({ role, generatedBy }) => Boolean(role && generatedBy)));
  assert.deepEqual(bundleManifest.publicExposure, {
    cardAvailable: false,
    route: true,
    href: false,
    cta: false,
    canonical: false,
    sitemap: false,
    fallback: false,
    download: false,
    publicWorkbook: false,
    publicBuildPage: true,
  });
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
  assert.doesNotMatch(engineContractText, /\uFFFD/, "Bundled engine contract must not contain U+FFFD");
  assert.doesNotMatch(engineSource, /from\s+["'][^"']*(?:dcfEngine|SidetradeScenario|react)/i);
  assert.doesNotMatch(engineSource, /\b(?:document|window)\./);

  const expectedSourceUrls = {
    S1: [
      "https://www.sanofi.com/en/media-room/press-releases/2024/2024-10-21-05-30-00-2965875",
    ],
    S2: [
      "https://www.sanofi.com/en/media-room/press-releases/2025/2025-04-30-11-00-00-3071167",
    ],
    S3: [
      "https://www.opella.com/dam/jcr%3A85e538d4-c944-4d64-9298-95fb4882b01e/20250430_Opella_Day%201%20PR_FR.pdf",
      "https://www.sanofi.com/assets/dotcom/content-app/publications/annual-report-on-form-20-f/2024-01-01-form-20-f-2024-en.pdf",
    ],
    S4: [],
    S5: [
      "https://www.sanofi.com/assets/dotcom/pressreleases/2025/2025-01-30-06-30-00-3017713-en.pdf",
    ],
    S6: [
      "https://www.opella.com/en/investors",
    ],
  };
  assert.deepEqual(snapshot.sources.map(({ id }) => id), Object.keys(expectedSourceUrls));
  for (const source of snapshot.sources) {
    const urls = source.references.flatMap((reference) => (
      reference.url ? [reference.url] : []
    ));
    assert.deepEqual(urls, expectedSourceUrls[source.id], `${source.id} canonical URL contract`);
    assert.ok(
      [
        "organization",
        "document",
        "publication_date",
        "accessed",
        "period_scope",
        "location",
        "evidence_role",
      ].every((field) => Boolean(source[field])),
      `${source.id} must expose the complete evidence metadata`,
    );
    for (const url of urls) {
      assert.ok(
        ["www.sanofi.com", "www.opella.com"].includes(new URL(url).hostname),
        `${source.id} must use an official canonical host`,
      );
      assert.doesNotMatch(url, /(?:google|bing|yahoo|duckduckgo|reuters|bloomberg)/i);
    }
  }
  assert.equal(snapshot.sources.find(({ id }) => id === "S4").evidence_role, "internal");
  assert.ok(snapshot.sources.find(({ id }) => id === "S4").references.every(
    (reference) => !reference.url && Boolean(reference.path),
  ));
  assert.deepEqual(
    {
      ebitda: [snapshot.m1.ebitda.status, snapshot.m1.ebitda.source],
      enterpriseValue: [snapshot.m1.enterpriseValue.status, snapshot.m1.enterpriseValue.source],
      entryMultiple: [snapshot.m1.entryMultiple.status, snapshot.m1.entryMultiple.source],
      margin: [snapshot.m1.margin.status, snapshot.m1.margin.source],
      reportedRevenue: [snapshot.m1.reportedRevenue.status, snapshot.m1.reportedRevenue.source],
      revenue: [snapshot.m1.revenue.status, snapshot.m1.revenue.source],
    },
    {
      ebitda: ["calculé", "S1"],
      enterpriseValue: ["public", "S1"],
      entryMultiple: ["public", "S1"],
      margin: ["calculé", "S1+S5+S6"],
      reportedRevenue: ["public", "S5"],
      revenue: ["public", "S5+S6"],
    },
    "Public anchors and derived proxies must keep their exact source classification",
  );

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
  assert.ok(
    base.modules.m7.periods.every(
      (row) => Math.abs(row.nOneOff - (row.s - row.eGap)) <= tolerance,
    ),
    "Central results must expose why the N = s - E mutant needs X5",
  );
  const falsificationCount = executeOpellaFalsifications(snapshot, sourceManifest, tolerance);
  const unexecutedDeclaration = structuredClone(sourceManifest);
  unexecutedDeclaration.fundingVectors.falsification.push({
    ...unexecutedDeclaration.fundingVectors.falsification.at(-1),
    id: "X-unexecuted",
  });
  assert.throws(
    () => executeOpellaFalsifications(snapshot, unexecutedDeclaration, tolerance),
    /Every declared falsification vector must have exactly one executable injector/,
    "A declared but unexecuted falsification vector must fail G2",
  );
  const falsificationCoverage = sourceManifest.fundingVectors.falsification
    .map(({ id, relation }) => `${id}→${relation}`)
    .join(", ");
  console.log(
    `Opella G2 falsifications: X1–X8 ${falsificationCount}/${sourceManifest.fundingVectors.falsification.length} executed and intercepted (${falsificationCoverage})`,
  );
  console.log("Opella G2 X5 residual mutant N = s − E: R-RECUR preserved, R-NPONC intercepted");

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

  const presentationApprovedNumbers = new Set(
    bundleManifest.allowedNonFinancialLiterals
      .filter(({ file, value }) => file === "src/routes/OpellaAnalysisView.jsx" && /^\d+(?:\.\d+)?$/.test(value))
      .map(({ value }) => value),
  );
  for (const filename of bundleManifest.presentationFiles) {
    await assertNoUnapprovedNumericLiterals(
      path.join(repositoryRoot, filename),
      presentationApprovedNumbers,
      filename,
    );
  }
  const presentationSources = Object.fromEntries(await Promise.all(
    bundleManifest.presentationFiles.map(async (filename) => [
      filename,
      await readFile(path.join(repositoryRoot, filename), "utf8"),
    ]),
  ));
  const opellaViewSource = presentationSources["src/routes/OpellaAnalysisView.jsx"];
  const opellaCopySource = presentationSources["src/data/opellaCase.js"];
  assert.doesNotMatch(
    opellaViewSource,
    />\s*[-+]?\d+(?:[.,]\d+)?\s*(?:%|x|M€|€m|€)\s*</,
    "G3: Opella JSX must not contain a rendered financial literal",
  );
  assert.doesNotMatch(
    opellaCopySource,
    /:\s*["'`][^"'`\n]*(?:€|\b\d+(?:[.,]\d+)?\s*(?:%|x|M€|€m))[^"'`\n]*["'`]/,
    "G3: Opella dictionaries must not carry financial values",
  );
  assert.match(opellaViewSource, /line\.contribution\[result\.calendar\.maxHorizon\]/);
  assert.match(opellaViewSource, /snapshot\.outputs\["O-SEPCOST"\]|kpis\["O-SEPCOST"\]/);
  assert.match(opellaCopySource, /hors BFR de séparation/);
  assert.match(opellaCopySource, /excluding separation working capital/);
  console.log(
    `Opella G3 lineage: ${bundleManifest.presentationFiles.length} presentation files, registry/engine values only`,
  );

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
