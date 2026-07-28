import bundledEngineContract from "../../integrations/opella/engine-contract.json" with { type: "json" };
import bundledManifest from "../../integrations/opella/manifest.json" with { type: "json" };
import bundledSnapshot from "../../integrations/opella/snapshot.json" with { type: "json" };
import bundledSourceManifest from "../../integrations/opella/source-manifest.json" with { type: "json" };

export class OpellaRegistryError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = "OpellaRegistryError";
    this.code = code;
  }
}

const fail = (code, message) => {
  throw new OpellaRegistryError(code, message);
};

const requireObject = (value, path) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("OP-REGISTRY-REQUIRED", `${path} must be an object`);
  }
  return value;
};

const requireValue = (value, path) => {
  if (value === undefined || value === null || value === "") {
    fail("OP-REGISTRY-REQUIRED", `${path} is required`);
  }
  return value;
};

const assertUniqueBy = (rows, key, path) => {
  if (!Array.isArray(rows)) {
    fail("OP-REGISTRY-REQUIRED", `${path} must be an array`);
  }
  const values = rows.map((row) => requireValue(row?.[key], `${path}[].${key}`));
  if (new Set(values).size !== values.length) {
    fail("OP-REGISTRY-DUPLICATE", `${path}[].${key} must be unique`);
  }
};

function valuesAtPath(root, declaredPath) {
  let values = [root];
  for (const segment of declaredPath.split(".")) {
    const many = segment.endsWith("[]");
    const key = many ? segment.slice(0, -2) : segment;
    const next = [];
    for (const value of values) {
      const resolved = value?.[key];
      if (many) {
        if (!Array.isArray(resolved) || resolved.length === 0) {
          fail("OP-REGISTRY-REQUIRED", `${declaredPath} must resolve to a non-empty array`);
        }
        next.push(...resolved);
      } else {
        requireValue(resolved, declaredPath);
        next.push(resolved);
      }
    }
    values = next;
  }
  return values;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

function collectNamedValues(value, key, found = new Set()) {
  if (!value || typeof value !== "object") {
    return found;
  }
  if (!Array.isArray(value) && typeof value[key] === "string") {
    found.add(value[key]);
  }
  for (const child of Object.values(value)) {
    collectNamedValues(child, key, found);
  }
  return found;
}

function validateSnapshot(snapshot, sourceManifest, bundleManifest, engineContract) {
  requireObject(snapshot, "snapshot");
  requireObject(sourceManifest, "sourceManifest");
  requireObject(bundleManifest, "bundleManifest");
  requireObject(engineContract, "engineContract");

  requireValue(snapshot.case, "snapshot.case");
  requireValue(snapshot.currency, "snapshot.currency");
  requireValue(snapshot.unit, "snapshot.unit");
  requireValue(snapshot.generatedBy, "snapshot.generatedBy");
  requireValue(snapshot.generatedAt, "snapshot.generatedAt");

  assertUniqueBy(snapshot.sources, "id", "snapshot.sources");
  assertUniqueBy(snapshot.lineage, "id", "snapshot.lineage");
  assertUniqueBy(snapshot.calendar?.periods, "id", "snapshot.calendar.periods");
  assertUniqueBy(snapshot.m3?.functions, "id", "snapshot.m3.functions");
  assertUniqueBy(snapshot.m4?.services, "id", "snapshot.m4.services");
  assertUniqueBy(snapshot.m5?.lines, "id", "snapshot.m5.lines");
  assertUniqueBy(snapshot.m7?.inventory, "id", "snapshot.m7.inventory");
  assertUniqueBy(snapshot.m7?.periods, "period", "snapshot.m7.periods");
  assertUniqueBy(sourceManifest.relations, "id", "sourceManifest.relations");
  assertUniqueBy(sourceManifest.scenarioLevers, "id", "sourceManifest.scenarioLevers");

  const registryFields = sourceManifest.financialRegistryFields;
  if (!Array.isArray(registryFields) || new Set(registryFields).size !== registryFields.length) {
    fail("OP-REGISTRY-DUPLICATE", "sourceManifest.financialRegistryFields must be present and unique");
  }
  for (const field of registryFields) {
    valuesAtPath(snapshot, field);
  }

  const sourceIds = new Set(snapshot.sources.map(({ id }) => id));
  for (const source of snapshot.sources) {
    for (const field of sourceManifest.sourceContract.requiredFields) {
      requireValue(source[field], `snapshot.sources[${source.id}].${field}`);
    }
  }
  for (const field of Object.values(snapshot.m1)) {
    const leaves = field && typeof field === "object" && "value" in field
      ? [field]
      : Object.values(field);
    for (const leaf of leaves) {
      requireValue(leaf.status, "snapshot.m1.*.status");
      requireValue(leaf.source, "snapshot.m1.*.source");
      requireValue(leaf.formatId, "snapshot.m1.*.formatId");
      for (const sourceId of leaf.source.split("+")) {
        if (!sourceIds.has(sourceId)) {
          fail("OP-REGISTRY-LINEAGE", `unknown source ${sourceId}`);
        }
      }
    }
  }

  const horizon = snapshot.calendar.horizon;
  const modeledPeriods = snapshot.m7.periods.map(({ period }) => period);
  if (horizon.length !== modeledPeriods.length || horizon.some((period, index) => modeledPeriods[index] !== period)) {
    fail("OP-REGISTRY-PERIODS", "calendar.horizon and m7.periods must be identical and ordered");
  }
  if (horizon.at(-1) !== snapshot.calendar.maxHorizon || horizon.at(-1) !== snapshot.m7.horizon.period) {
    fail("OP-REGISTRY-PERIODS", "maxHorizon must have one canonical period carrier");
  }

  const currentState = snapshot.m7.resorb.state;
  if (snapshot.outputs["O-RESORB"].state !== currentState) {
    fail("OP-REGISTRY-CARRIER", "O-RESORB state differs from m7.resorb.state");
  }
  for (const forbidden of ["needAtHorizon", "eGap", "nOneOff"]) {
    if (forbidden in snapshot.outputs["O-RESORB"]) {
      fail("OP-REGISTRY-CARRIER", `outputs.O-RESORB.${forbidden} duplicates periods[]`);
    }
  }
  const absentStates = sourceManifest.canonicalCarriers.Pk.absentStates;
  if (absentStates.includes(currentState) && "pk" in snapshot.m7.resorb) {
    fail("OP-REGISTRY-CARRIER", "Pk must be truly absent for the current O-RESORB state");
  }

  if (bundleManifest.financialRegistryFields.count !== registryFields.length) {
    fail("OP-REGISTRY-CONTRACT", "bundle registry field count differs from the O1 contract");
  }
  if (Object.keys(engineContract.levers).length !== sourceManifest.scenarioLevers.length) {
    fail("OP-REGISTRY-CONTRACT", "engine lever contract differs from the O1 manifest");
  }
}

export function readFinancialRegistryPath(snapshot, path) {
  const values = valuesAtPath(snapshot, path);
  return path.includes("[]") ? values : values[0];
}

export function createOpellaFinancials(
  snapshotInput = bundledSnapshot,
  {
    sourceManifestInput = bundledSourceManifest,
    bundleManifestInput = bundledManifest,
    engineContractInput = bundledEngineContract,
  } = {},
) {
  const snapshot = structuredClone(snapshotInput);
  const sourceManifest = structuredClone(sourceManifestInput);
  const bundleManifest = structuredClone(bundleManifestInput);
  const engineContract = structuredClone(engineContractInput);
  validateSnapshot(snapshot, sourceManifest, bundleManifest, engineContract);

  const registry = {
    calculation: {
      m1: snapshot.m1,
      m2: snapshot.m2,
      m3: snapshot.m3,
      m4: snapshot.m4,
      m5: snapshot.m5,
      m6: snapshot.m6,
      m7: snapshot.m7,
      m8: snapshot.m8,
      outputs: snapshot.outputs,
      scenarios: snapshot.scenarios,
    },
    display: {
      currency: snapshot.currency,
      unit: snapshot.unit,
      units: {
        relationUnits: Object.keys(sourceManifest.toleranceUnits),
        scenarioUnits: Object.fromEntries(
          Object.entries(snapshot.scenarios).map(([id, scenario]) => [id, scenario.unit]),
        ),
      },
      periods: snapshot.calendar.periods,
      defaultFormats: Object.fromEntries(
        Object.entries(snapshot.outputs).map(([id, output]) => [id, output.formatId ?? null]),
      ),
    },
    translation: {
      caseId: snapshot.case,
      outputIds: Object.keys(snapshot.outputs),
      scenarioIds: Object.keys(snapshot.scenarios),
      carriesFinancialValues: false,
    },
    metadata: {
      generatedBy: snapshot.generatedBy,
      generatedAt: snapshot.generatedAt,
      sources: snapshot.sources,
      lineage: snapshot.lineage,
      calendar: snapshot.calendar,
      statuses: [...collectNamedValues(snapshot, "status")].sort(),
    },
    contracts: {
      sourceManifest,
      bundleManifest,
      engine: engineContract,
      financialRegistryFields: sourceManifest.financialRegistryFields,
      relations: sourceManifest.relations,
    },
    snapshot,
  };

  return deepFreeze(registry);
}

export const opellaFinancials = createOpellaFinancials();
