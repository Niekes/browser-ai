#!/usr/bin/env node
/**
 * Checks the browser-ai registry template.
 *
 * The template is the shape of the registry, not just its behaviour:
 *
 *   registry.json                         one item per registry file
 *   registry/new-york/ui/<name>.tsx       a component, an item of its own
 *   registry/new-york/hooks/<name>.ts     a hook, an item of its own; a
 *   registry/new-york/hooks/<n>.worker.ts worker belongs to the item of the hook
 *                                         that starts it
 *   tests/<file>.test.ts(x)               one test file per registry file
 *   docs/content/components/<item>.mdx    one docs page per item
 *   docs/examples/<item>-demo.tsx         the example the page shows
 *
 * Fallow covers the parts that need a real dependency graph (layering, dead
 * code, test coverage). This script covers naming and shape, which are
 * cheaper to check by reading the source directly.
 *
 * Usage: node scripts/check-template.mjs
 */

import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const DIRS = { "registry:ui": "registry/new-york/ui", "registry:hook": "registry/new-york/hooks" }
const OWN = "niekes/browser-ai/"

/** @type {string[]} */
const violations = []

/** @param {string} message */
const fail = (message) => violations.push(message)

/** @param {string} relativePath */
const read = (relativePath) => readFileSync(join(ROOT, relativePath), "utf8")

/** @param {string} relativePath */
const exists = (relativePath) => existsSync(join(ROOT, relativePath))

const files = Object.values(DIRS).flatMap((dir) =>
  readdirSync(join(ROOT, dir))
    .filter((entry) => /\.tsx?$/.test(entry))
    .map((entry) => `${dir}/${entry}`)
)
const registry = JSON.parse(read("registry.json"))
const { version, dependencies: packageDependencies } = JSON.parse(read("package.json"))
const listed = new Map(
  registry.items.flatMap((item) => (item.files ?? []).map((file) => [file.path, item]))
)

/**
 * The registry and the files agree: every file belongs to exactly one item,
 * whose name is the file's, and whose type puts it in its folder.
 */
for (const file of files) {
  const item = listed.get(file)
  if (!item) {
    fail(`${file}: belongs to no item in registry.json`)
    continue
  }
  const entry = item.files.find((f) => f.path === file)
  if (!file.startsWith(`${DIRS[entry.type]}/`)) {
    fail(`registry.json: '${file}' must be of the type of its folder`)
  }
  const stem = file
    .split("/")
    .pop()
    .replace(/\.tsx?$/, "")
  if (item.files[0].path === file && stem !== item.name) {
    fail(`registry.json: '${item.name}' must list its own file '${item.name}' first`)
  }
  if (item.files[0].path !== file && !stem.endsWith(".worker")) {
    fail(`registry.json: '${file}' is a second file of '${item.name}'; only a worker may be one`)
  }
}
for (const [path, item] of listed) {
  if (!files.includes(path)) fail(`registry.json: '${item.name}' lists '${path}', which is missing`)
}

/**
 * Every registry file but a worker is a client module; none has a default
 * export or an ignore comment for coverage, and every file has its tests.
 */
for (const file of files) {
  const source = read(file)
  const stem = file
    .split("/")
    .pop()
    .replace(/\.tsx?$/, "")
  const worker = stem.endsWith(".worker")

  if (!worker && !source.startsWith('"use client"')) {
    fail(`${file}: must start with the "use client" directive`)
  }
  if (/(v8|c8|istanbul)\s+ignore/.test(source)) {
    fail(`${file}: no coverage ignore comments; test the code or delete it`)
  }
  if (/^export\s+default\b/m.test(source)) {
    fail(`${file}: the registry has no default exports`)
  }
  if (/^export\s+const\s+\w+\s*=\s*[(<]/m.test(source)) {
    fail(`${file}: use 'export function' instead of 'export const' for components and hooks`)
  }
  if (!exists(`tests/${stem}.test.ts`) && !exists(`tests/${stem}.test.tsx`)) {
    fail(`${file}: is missing 'tests/${stem}.test.ts(x)'`)
  }
}

/**
 * Every item has its docs page and its example; a registry dependency on
 * this registry names an item of it, pinned to the release in a release.
 */
for (const item of registry.items) {
  for (const path of [
    `docs/content/components/${item.name}.mdx`,
    `docs/examples/${item.name}-demo.tsx`,
  ]) {
    if (!exists(path)) fail(`${item.name}: is missing '${path}'`)
  }
  for (const dependency of item.registryDependencies ?? []) {
    if (!dependency.startsWith(OWN)) continue
    const [name, tag] = dependency.slice(OWN.length).split("#")
    if (!registry.items.some((other) => other.name === name)) {
      fail(`registry.json: '${item.name}' depends on '${dependency}', which is no item`)
    }
    if (tag !== undefined && tag !== `v${version}`) {
      fail(`registry.json: '${item.name}' pins '${dependency}', not the release v${version}`)
    }
  }
}

/**
 * The registry installs the versions the repository tests: a range on an
 * item is the range of the dependency in package.json.
 */
for (const item of registry.items) {
  for (const dependency of item.dependencies ?? []) {
    const [, name, range] = dependency.match(/^(@?[^@]+)(?:@(.+))?$/) ?? []
    if (range !== packageDependencies[name]) {
      fail(
        `registry.json: '${item.name}' installs '${dependency}', package.json '${name}@${packageDependencies[name]}'`
      )
    }
  }
}

if (violations.length > 0) {
  console.error(`✗ ${violations.length} registry template violation(s):\n`)
  for (const violation of violations) {
    console.error(`  - ${violation}`)
  }
  console.error("")
  process.exit(1)
}

console.log("✓ registry template satisfied")
