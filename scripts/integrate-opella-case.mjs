import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertFileSha256,
  assertUnique,
  readJson,
  sha256File,
} from "./integration-manifest.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const bundleRoot = path.join(repositoryRoot, "integrations", "opella");
const defaultSourceRoot = path.resolve(
  process.env.OPELLA_SOURCE ?? path.join(repositoryRoot, "..", "Transaction Services"),
);
const parentBaseline = "8ad69b3152d237116e164cc5b4fdffd49b15308b";

export const opellaSourceNames = {
  generator: "build_carveout.py",
  workbook: "Modele_Carveout_Opella.xlsx",
  snapshot: "opella_case_snapshot.json",
  manifest: "opella_integration_manifest.json",
};

const pythonExtractor = String.raw`
import ast
import json
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="strict", newline="\n")

with open(sys.argv[1], encoding="utf-8") as handle:
    tree = ast.parse(handle.read(), filename=sys.argv[1])

wanted = {"LEVERS", "CENTRAL", "TSA_EXTENSION_UPLIFT", "MAX_PERIODS"}
values = {}
for node in tree.body:
    if isinstance(node, ast.Assign):
        for target in node.targets:
            if isinstance(target, ast.Name) and target.id in wanted:
                values[target.id] = ast.literal_eval(node.value)

missing = sorted(wanted - values.keys())
if missing:
    raise RuntimeError(f"missing canonical engine constants: {missing}")

print(json.dumps({
    "schemaVersion": 1,
    "generatedFrom": "build_carveout.py",
    "central": values["CENTRAL"],
    "levers": values["LEVERS"],
    "tsaExtensionUplift": values["TSA_EXTENSION_UPLIFT"],
    "maxPeriods": values["MAX_PERIODS"],
}, ensure_ascii=False, sort_keys=True))
`;

export const serializeOpellaEngineContract = (contract) => (
  `${JSON.stringify(contract, null, 2)}\n`
);

export async function extractOpellaEngineContract(
  generator,
  { environment = process.env } = {},
) {
  const python = environment.OPELLA_PYTHON ?? process.env.OPELLA_PYTHON ?? "python";
  const output = execFileSync(
    python,
    ["-X", "utf8", "-c", pythonExtractor, generator],
    {
      env: {
        ...environment,
        PYTHONIOENCODING: "utf-8:strict",
      },
    },
  );
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(output);
  assert.doesNotMatch(decoded, /\uFFFD/, "Python extraction must not contain U+FFFD");
  const contract = JSON.parse(decoded);
  contract.generatedFromSha256 = await sha256File(generator);
  return contract;
}

function bundleManifest(
  sourceManifest,
  sourceManifestSha,
  engineContractSha,
  attributesSha,
  presentationContract = {},
) {
  const sourceFiles = Object.entries(sourceManifest.sourceFiles).map(([name, sha256]) => ({
    path: `Transaction Services/${name}`,
    sha256,
  }));
  sourceFiles.push({
        path: `Transaction Services/${opellaSourceNames.manifest}`,
    sha256: sourceManifestSha,
  });

  return {
    manifest: "opella-sidetrade-inactive-bundle",
    version: "1.1.0",
    case: "opella-carve-out",
    pass: "O2-E",
    status: "inactive",
    sourceBaseline: {
      repository: "parent",
      commit: parentBaseline,
      note: "Transaction Services is not an autonomous repository; no synthetic commit pin is used.",
    },
    sourceFiles,
    snapshotIdentity: {
      source: `Transaction Services/${opellaSourceNames.snapshot}`,
      bundle: "snapshot.json",
      sha256: sourceManifest.sourceFiles[opellaSourceNames.snapshot],
    },
    bundleFiles: [
      {
        path: "snapshot.json",
        sha256: sourceManifest.sourceFiles[opellaSourceNames.snapshot],
        mime: "application/json",
        role: "Byte-identical O1 semantic snapshot and sole carrier of financial values.",
      },
      {
        path: "source-manifest.json",
        sha256: sourceManifestSha,
        mime: "application/json",
        role: "Byte-identical O1 chain, relation, tolerance, lineage and vector contract.",
      },
      {
        path: "engine-contract.json",
        sha256: engineContractSha,
        mime: "application/json",
        role: "Generated extraction of the O1 scenario lever constants required by the JavaScript engine.",
      },
      {
        path: ".gitattributes",
        sha256: attributesSha,
        mime: "text/plain",
        role: "Repository-local LF serialization contract preserving byte-identical JSON checkouts.",
      },
    ],
    generatedFiles: [
      {
        path: "snapshot.json",
        generatedBy: "Transaction Services/build_carveout.py",
        role: "financial-values",
      },
      {
        path: "source-manifest.json",
        generatedBy: "Transaction Services/build_carveout.py",
        role: "source-contract",
      },
      {
        path: "engine-contract.json",
        generatedBy: "Sidetrade/scripts/integrate-opella-case.mjs",
        role: "engine-input-contract",
      },
      {
        path: ".gitattributes",
        generatedBy: "Sidetrade/scripts/integrate-opella-case.mjs",
        role: "serialization-contract",
      },
    ],
    downloads: [],
    presentationFiles: [],
    financialRegistryFields: {
      source: "source-manifest.json#/financialRegistryFields",
      count: sourceManifest.financialRegistryFields.length,
      exposure: "registered-but-not-public",
    },
    formulas: {
      source: "source-manifest.json#/relations",
      count: sourceManifest.relations.length,
    },
    fundingVectors: {
      source: "source-manifest.json#/fundingVectors",
      normativeCount: sourceManifest.fundingVectors.normative.length,
      falsificationCount: sourceManifest.fundingVectors.falsification.length,
      coverageCount: sourceManifest.fundingVectors.coverage.vectors.length,
    },
    scenarios: {
      leverContract: "engine-contract.json#/levers",
      expectedResults: "snapshot.json#/scenarios",
      leverCount: sourceManifest.scenarioLevers.length,
    },
    registry: {
      module: "src/data/opellaFinancials.js",
      values: "snapshot.json",
      metadata: "snapshot.json",
      contracts: ["source-manifest.json", "engine-contract.json"],
    },
    engine: {
      module: "src/utils/opellaEngine.js",
      inputs: ["snapshot.json", "engine-contract.json"],
      vectors: "source-manifest.json#/fundingVectors",
    },
    literalPolicy: {
      scannedFiles: [
        "src/data/opellaFinancials.js",
        "scripts/check-opella-integration.mjs",
      ],
      allowedNumericLiterals: [
        {
          value: "0",
          reason: "structural zero, empty-state and index validation only",
        },
        {
          value: "1",
          reason: "structural cardinality and mutation validation only",
        },
        {
          value: "2",
          reason: "structural removal of the [] suffix in declared registry paths only",
        },
      ],
    },
    allowedNonFinancialLiterals: [],
    requiredPublicMessages: {
      status: "deferred-until-public-view",
      fr: [],
      en: [],
    },
    forbiddenPublicTerms: {
      status: "deferred-until-public-view",
      fr: [],
      en: [],
    },
    publicExposure: {
      cardAvailable: false,
      route: false,
      href: false,
      cta: false,
      canonical: false,
      sitemap: false,
      fallback: false,
      download: false,
      publicWorkbook: false,
      publicBuildPage: false,
    },
    ...presentationContract,
  };
}

export async function integrateOpellaBundle(sourceRoot = defaultSourceRoot) {
  const sourceManifestPath = path.join(sourceRoot, opellaSourceNames.manifest);
  const sourceManifest = await readJson(sourceManifestPath);
  assert.equal(sourceManifest.manifest, "opella-transaction-services");
  assertUnique(sourceManifest.financialRegistryFields, "O1 financialRegistryFields");
  assertUnique(sourceManifest.relations.map(({ id }) => id), "O1 relations");

  for (const [name, expected] of Object.entries(sourceManifest.sourceFiles)) {
    await assertFileSha256(path.join(sourceRoot, name), expected, `O1 source ${name}`);
  }

  const engineContract = await extractOpellaEngineContract(
    path.join(sourceRoot, opellaSourceNames.generator),
  );
  const engineContractText = serializeOpellaEngineContract(engineContract);
  assert.doesNotMatch(engineContractText, /\uFFFD/, "Engine contract must not contain U+FFFD");
  const attributesText = ".gitattributes text eol=lf\n*.json text eol=lf\n";
  const sourceManifestSha = await sha256File(sourceManifestPath);
  let presentationContract = {};
  try {
    const currentManifest = await readJson(path.join(bundleRoot, "manifest.json"));
    presentationContract = Object.fromEntries(
      [
        "downloads",
        "presentationFiles",
        "allowedNonFinancialLiterals",
        "requiredPublicMessages",
        "forbiddenPublicTerms",
        "publicExposure",
      ]
        .filter((key) => Object.hasOwn(currentManifest, key))
        .map((key) => [key, currentManifest[key]]),
    );
  } catch {
    // A first integration has no presentation contract to preserve.
  }

  await mkdir(bundleRoot, { recursive: true });
  await copyFile(
    path.join(sourceRoot, opellaSourceNames.snapshot),
    path.join(bundleRoot, "snapshot.json"),
  );
  await copyFile(sourceManifestPath, path.join(bundleRoot, "source-manifest.json"));
  await writeFile(path.join(bundleRoot, "engine-contract.json"), engineContractText, "utf8");
  await writeFile(path.join(bundleRoot, ".gitattributes"), attributesText, "utf8");

  const engineContractSha = await sha256File(path.join(bundleRoot, "engine-contract.json"));
  const attributesSha = await sha256File(path.join(bundleRoot, ".gitattributes"));
  const manifest = bundleManifest(
    sourceManifest,
    sourceManifestSha,
    engineContractSha,
    attributesSha,
    presentationContract,
  );
  await writeFile(path.join(bundleRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  assert.equal(
    await readFile(path.join(sourceRoot, opellaSourceNames.snapshot), "utf8"),
    await readFile(path.join(bundleRoot, "snapshot.json"), "utf8"),
    "Integrated snapshot must remain byte-identical",
  );
  assert.equal(
    await readFile(sourceManifestPath, "utf8"),
    await readFile(path.join(bundleRoot, "source-manifest.json"), "utf8"),
    "Integrated source manifest must remain byte-identical",
  );

  console.log(`Opella inactive bundle integrated from parent baseline ${parentBaseline}`);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await integrateOpellaBundle();
}
