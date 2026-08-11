import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export async function sha256File(filename) {
  return createHash("sha256").update(await readFile(filename)).digest("hex").toUpperCase();
}

export async function readCanonicalLfText(filename) {
  return (await readFile(filename, "utf8")).replace(/\r\n/g, "\n");
}

export async function sha256CanonicalLfTextFile(filename) {
  return createHash("sha256")
    .update(await readCanonicalLfText(filename), "utf8")
    .digest("hex")
    .toUpperCase();
}

export async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

export async function assertFileSha256(filename, expected, label = filename) {
  const actual = await sha256File(filename);
  assert.equal(actual, expected, `${label} SHA-256 mismatch`);
  return actual;
}

export async function assertCanonicalLfTextFileSha256(filename, expected, label = filename) {
  const actual = await sha256CanonicalLfTextFile(filename);
  assert.equal(actual, expected, `${label} canonical LF SHA-256 mismatch`);
  return actual;
}

export async function listRelativeFiles(root) {
  const files = [];

  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile()) {
        files.push(path.relative(root, absolute).split(path.sep).join("/"));
      }
    }
  }

  await visit(root);
  return files.sort();
}

export async function assertClosedDirectory(root, expectedFiles, label) {
  const actual = await listRelativeFiles(root);
  const expected = [...expectedFiles].sort();
  assert.deepEqual(actual, expected, `${label} file closure mismatch`);
  return actual;
}

export function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} contains duplicates`);
}

function stripStringsAndComments(source) {
  let output = "";
  let index = 0;
  let mode = "code";
  let quote = "";

  while (index < source.length) {
    const current = source[index];
    const next = source[index + 1];

    if (mode === "line-comment") {
      if (current === "\n") {
        mode = "code";
        output += "\n";
      } else {
        output += " ";
      }
      index += 1;
      continue;
    }

    if (mode === "block-comment") {
      if (current === "*" && next === "/") {
        output += "  ";
        index += 2;
        mode = "code";
      } else {
        output += current === "\n" ? "\n" : " ";
        index += 1;
      }
      continue;
    }

    if (mode === "string") {
      if (current === "\\") {
        output += "  ";
        index += 2;
      } else if (current === quote) {
        output += " ";
        index += 1;
        mode = "code";
      } else {
        output += current === "\n" ? "\n" : " ";
        index += 1;
      }
      continue;
    }

    if (current === "/" && next === "/") {
      output += "  ";
      index += 2;
      mode = "line-comment";
      continue;
    }
    if (current === "/" && next === "*") {
      output += "  ";
      index += 2;
      mode = "block-comment";
      continue;
    }
    if (current === "'" || current === '"' || current === "`") {
      quote = current;
      output += " ";
      index += 1;
      mode = "string";
      continue;
    }

    output += current;
    index += 1;
  }

  return output;
}

export async function assertNoUnapprovedNumericLiterals(filename, approved, label) {
  const source = stripStringsAndComments(await readFile(filename, "utf8"));
  const matches = [...source.matchAll(/(?<![\w.])(?:0[xob][\da-f]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)(?![\w.])/gi)]
    .map((match) => match[0]);
  const rejected = [...new Set(matches.filter((value) => !approved.has(value)))];
  assert.deepEqual(rejected, [], `${label} contains unapproved numeric literals`);
}
