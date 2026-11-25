# Contributing to browser-ai

Thanks for taking the time to contribute. browser-ai is maintained by one
person in spare time, so every pull request that saves a day of debugging is
worth a lot.

## Getting started

```bash
git clone https://github.com/niekes/browser-ai.git
cd browser-ai
pnpm install
pnpm docs:dev
```

Node 22, 24 or newer and pnpm are required. The docs run at
`http://localhost:5173/browser-ai/`. To try the speech input itself you need
a desktop browser with WebGPU and 16-bit floats (`shader-f16`): Chrome or
Edge, or Firefox, where the live text is slower.

## The checks that have to pass

```bash
pnpm verify    # lint and coverage: the whole gate
pnpm test:e2e  # the demo page in Chrome, with a WAV file as the microphone
pnpm build     # typecheck + registry JSON + docs
```

`pnpm lint` runs four things:

- `vp fmt --check` checks the formatting; `vp fmt` fixes it.
- `vp lint` lints the code, type-aware.
- `pnpm lint:template` checks that the registry follows the template in
  [AGENTS.md](./AGENTS.md).
- `pnpm lint:fallow` checks layering, dead code, test coverage and
  duplication, and that the fallow health score stays at 98 or above.

`pnpm coverage` runs the unit tests and fails when the coverage of the
registry drops below 98 % in any metric. `pnpm test` runs them alone. No test
runs the real model.

## Repository layout

| Path                         | Zone      | What lives there                                       |
| ---------------------------- | --------- | ------------------------------------------------------ |
| `registry/new-york/ui/**`    | `ui`      | The components.                                        |
| `registry/new-york/hooks/**` | `hooks`   | The hooks, and the worker that runs the model.         |
| `registry.json`              |           | The registry: one item per component or hook.          |
| `components/ui/**`           | `shadcn`  | shadcn's own components, which the registry builds on. |
| `lib/**`                     | `lib`     | `cn`, as every shadcn project has it.                  |
| `tests/**`, `e2e/**`         | `tests`   | The unit tests and the Playwright test.                |
| `docs/**`                    | `docs`    | The documentation site: Fumadocs on React Router.      |
| `scripts/**`                 | `tooling` | Repository tooling. Imports nothing from the registry. |

## Code style

- The style of shadcn/ui: two spaces, double quotes, no semicolons. `vp fmt`
  applies it.
- Props as a named type with a comment on every prop: the docs generate the
  API table from it.
- No default exports in the registry, and no `console` calls in code that
  lands in other projects.
- No function in the registry is longer than 60 lines.

## Pull requests

- Keep them focused. Open an issue first for anything larger than a bug fix.
- Describe what changed and why.
- Make sure `pnpm verify` passes locally.

## Documentation

```bash
pnpm docs:dev      # local dev server
pnpm docs:build    # production build into build/client
pnpm docs:preview  # serve the production build
```

GitHub Pages serves the site under `/browser-ai/`, so `docs:build` moves the
prerendered pages from `build/client/browser-ai/` to the root of
`build/client/`, and keeps the SPA fallback as `404.html`. The docs deploy
from the tag of every release, or by hand from the Actions tab; the
`github-pages` environment has to allow deployments from `v*` tags.

## Releases

The registry is the product; there is no npm package. A release is a pull
request that bumps the version in `package.json` and updates `CHANGELOG.md`.
Merging it into `main` runs the [Release workflow](.github/workflows/release.yml):
it makes a release commit beside `main` in which every dependency on this
registry is pinned to `#v<version>`, tags it, creates the GitHub release with
the version's notes and deploys the docs from the tag. The items can then be
pinned with `npx shadcn add niekes/browser-ai/<item>#v<version>`.
