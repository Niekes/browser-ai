<!-- fallow:setup-hooks:start -->

## Fallow checks

Use fallow for code-quality, cleanup, and setup tasks in this repository. Fallow checks the changed code before each `git commit` and `git push`. In Claude Code and Codex, a PreToolUse hook from `fallow agent install` runs this check and blocks the command when the verdict is `fail`. Other agents run the check themselves: `fallow audit --format json --quiet --explain --gate-marker agent`. If the verdict is `fail`, fix the reported findings before you try again. A JSON runtime error such as `{ "error": true, ... }` does not block.

Audit defaults to `gate=new-only`: only findings introduced by the current changeset affect the verdict. Inherited findings on touched files are reported under `attribution` and annotated with `introduced: false`, but do not block the commit. Set `[audit] gate = "all"` in `fallow.toml` to gate every finding in changed files.

For non-skill agents, treat the task map below as the local onboarding source: run the listed fallow command before destructive edits, before commits, and before pull request handoff.

## Fallow task map

| When the agent is about to...                                        | Run                                                                                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| delete an "unused" export or file                                    | `fallow dead-code --trace <file>:<export>`                                                                                                                    |
| prove a TypeScript symbol's exact consumers before refactoring       | `fallow dead-code --type-aware --symbol-impact <file>:<export-or-class.method>`                                                                               |
| find how one module reaches another                                  | `fallow trace --path <from> <to>` (Reports `reachable: false` instead of failing when no import path exists; type-only hops are reported, not skipped.)       |
| delete an "unused" dependency                                        | `fallow dead-code --trace-dependency <name>`                                                                                                                  |
| migrate a dependency                                                 | `fallow trace --dependency <name> --sites` (Counts each imported name, follows one hop through project wrappers, and counts each use that it cannot resolve.) |
| commit or open a PR                                                  | `fallow audit --base <ref>`                                                                                                                                   |
| read a diff before approving it                                      | `fallow review --base <ref> --brief` (orientation, never gates: deterministic and always exit 0, unlike the audit row)                                        |
| prioritize refactoring                                               | `fallow health --hotspots --targets`                                                                                                                          |
| ask who owns code                                                    | `fallow health --ownership`                                                                                                                                   |
| check untested-but-reachable code                                    | `fallow health --coverage-gaps`                                                                                                                               |
| consolidate duplication                                              | `fallow dupes --trace dup:<fingerprint>`                                                                                                                      |
| find feature flags                                                   | `fallow flags`                                                                                                                                                |
| check which architecture rules apply to a file before changing it    | `fallow guard <files>`                                                                                                                                        |
| check import cycles, boundaries and policy rules after changing code | `fallow architecture`                                                                                                                                         |
| surface security candidates                                          | `fallow security`                                                                                                                                             |
| understand a finding                                                 | `fallow explain <issue-type>`                                                                                                                                 |
| scope a monorepo                                                     | `--workspace <glob> / --changed-workspaces <ref>` (global flags, prefix any command)                                                                          |

<!-- fallow:setup-hooks:end -->

## Releasing

A release is a pull request that bumps the version in `package.json` and
updates `CHANGELOG.md` (for example the `release/0.1.0` branch). Merging it
into `main` triggers `.github/workflows/release.yml`, which - if the tag is
missing - tags a release commit beside `main`, creates the `vX.Y.Z` release
on GitHub with the version's section of `CHANGELOG.md`, and deploys the docs
from that tag. There is no npm package: the registry is the product. Never
push a version tag by hand.

## The registry template

`browser-ai` is a shadcn registry: its files are copied into other projects.
Its template is enforced by `pnpm lint`, which runs in CI, in the Git
pre-commit hook and in the agent hooks above.

```bash
pnpm verify          # the whole gate: lint and coverage
pnpm lint            # format, lint, template, fallow
pnpm lint:template   # naming and shape conventions
pnpm lint:fallow     # layering, dead code, test coverage, duplication, health >= 98
pnpm test:e2e        # the demo page in Chrome, a WAV file for the microphone
```

### Health and coverage

`fallow health --min-score 98` is part of the gate, so **no function in the
registry is longer than 60 lines**: split a long component along its seams,
as `speech-input.tsx` does - a hook for behaviour (`useDictation`), a
component per part (`MicButton`, `DownloadPrompt`, `DownloadProgress`).

`pnpm coverage` fails when the registry drops below **98 % in each of
statements, branches, functions and lines**:

- **New code comes with its tests**, written first.
- **Unreachable code is deleted, not excluded.** Coverage ignore comments
  fail the template check.
- **A fix comes with the test that fails without it.**

The tests drive the registry the way a page does. jsdom has no worker, no
audio and no microphone: `tests/fakes.ts` stands in for them - `FakeWorker`
answers the messages of the worker, `FakeNode` speaks samples into the
recorder. The worker itself is tested with `parakeet.js` mocked. No real
model runs in CI; the Playwright test feeds `e2e/hello.wav` as the
microphone and answers with a fake worker.

### The layers

The zones are declared in `.fallowrc.jsonc` and a violation fails the build.

| Zone      | Files                        | May import                             |
| --------- | ---------------------------- | -------------------------------------- |
| `ui`      | `registry/new-york/ui/**`    | `hooks`, `shadcn`, `lib`               |
| `hooks`   | `registry/new-york/hooks/**` | nothing                                |
| `shadcn`  | `components/ui/**`           | `lib`                                  |
| `lib`     | `lib/**`                     | nothing                                |
| `tests`   | `tests/**`, `e2e/**`         | `tests`, `ui`, `hooks`                 |
| `docs`    | `docs/**`                    | `docs`, `ui`, `hooks`, `shadcn`, `lib` |
| `tooling` | `scripts/**`                 | nothing                                |

`components/ui` holds shadcn's own button, progress and textarea, as a
project that installs the registry has them; they are no registry items.

### The template

The rules that `scripts/check-template.mjs` enforces:

- every file in `registry/new-york/ui/` and `registry/new-york/hooks/`
  belongs to one item of `registry.json`, named after its first file; a
  second file of an item is a worker (`<name>.worker.ts`), beside its hook;
- every registry file but a worker starts with `"use client"`, and none has
  a default export or a coverage ignore comment;
- every registry file has `tests/<file>.test.ts(x)`, every item
  `docs/content/components/<item>.mdx` and `docs/examples/<item>-demo.tsx`;
- a registry dependency on this registry names one of its items, unpinned on
  `main` and pinned to `#v<version>` only in the release commit;
- every npm dependency of an item names the range `package.json` gives it.

### Speech input

The terms are in `GLOSSARY.md` (dictation, live text, final text, model
download, engine, browser fallback) and the decisions in `docs/adr/`.

- **One engine per page** (ADR-0001). `use-speech-to-text.ts` keeps the
  worker, the model state and the one dictation in module state, read through
  `useSyncExternalStore`; every hook of the page sees it, and a hook that
  does not dictate while another does reads `busy`.
- **The worker owns the model**, `speech-to-text.worker.ts`: it probes the
  browser and the cache, loads the pinned model, and transcribes one message
  at a time. Its messages: `probe`, `load`, `transcribe` in; `probe`,
  `progress`, `ready`, `text`, `error` out.
- **Live text** (ADR-0002): a pass over the whole dictation about every
  second; past a minute the older words freeze.
- **The download is confirmed** (ADR-0003); **desktop browsers with WebGPU
  and `shader-f16`** (ADR-0005): the worker checks the adapter, the page
  tells it whether it is on a phone or a tablet.
- **The browser fallback is opt-in** (ADR-0006): with `browserFallback`,
  where the engine cannot run, the hook dictates with the browser's
  `SpeechRecognition` instead, without the worker, and reads
  `browser-fallback`; the input says the audio may leave the device. Off,
  nothing changes. The docs examples turn it on.
- **The input is controlled.** `SpeechInput` takes `value` and
  `onChange(value)`, shows the live text at the cursor while the textarea is
  read-only, and calls `onChange` once with the final text.

### Code style

The style of shadcn/ui - two spaces, double quotes, no semicolons - because
the files land in shadcn projects. `vp fmt` enforces it.

### The docs

Fumadocs on React Router, built with Vite+ and prerendered to static HTML for
GitHub Pages. Pages live in `docs/content`, the examples they show in
`docs/examples`. The examples import the registry as
`@/components/ui/speech-input` and `@/hooks/use-speech-to-text`, the way a
project that installed it does; Vite and TypeScript resolve those aliases to
the registry.

The docs have their own server entry, `docs/entry.server.tsx`: without it,
React Router's default entry needs `isbot`, and the React Router CLI installs
it. Keep the entry.

## Agent skills

### Issue tracker

Issues live in GitHub Issues of Niekes/browser-ai, through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
