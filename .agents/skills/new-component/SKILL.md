---
name: new-component
description: Load when adding a component or hook to the browser-ai registry ("add a <name> component", "new hook for ..."). Walks the template end to end: the registry file, registry.json, the tests, the demo, the docs page and the gates.
---

# New component

Read `AGENTS.md` ("The registry template", "The layers") and `GLOSSARY.md`
first, and use `speech-input` and `use-speech-to-text` as the reference.

1. **Tests first.** Agree the seams, then write `tests/<name>.test.ts(x)`
   red before green. No real model in a test: stand in for the worker and the
   browser APIs as `tests/fakes.ts` does.
2. **The file.** `registry/new-york/ui/<name>.tsx` (a component) or
   `registry/new-york/hooks/<name>.ts` (a hook): `"use client"`, no default
   export, `export function`, a named props type with a comment on every
   prop. A model runs in a worker, `<name>.worker.ts` beside its hook, listed
   as the second file of the hook's item.
3. **The item** in `registry.json`: its npm dependencies at the ranges of
   `package.json`, shadcn's components and `niekes/browser-ai/<item>` as
   registry dependencies.
4. **The docs.** `docs/examples/<name>-demo.tsx` and
   `docs/content/components/<name>.mdx`, listed in
   `docs/content/components/meta.json`. A model names its size and license,
   and downloads only once the reader confirms it.
5. **A decision** worth keeping goes to `docs/adr/`, a new term to
   `GLOSSARY.md`, the change to `CHANGELOG.md` under Unreleased.
6. **The gates.** `pnpm verify` and `pnpm test:e2e`.
