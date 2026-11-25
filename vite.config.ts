import { fileURLToPath } from "node:url"
import { reactRouter } from "@react-router/dev/vite"
import tailwindcss from "@tailwindcss/vite"
import { fumadocsMdx } from "fumadocs-mdx/vite"
import { remarkAutoTypeTable } from "fumadocs-typescript"
import { defineConfig } from "vite-plus"

// Generated files: the builds, the coverage, the registry JSON, the React Router types and the badges.
const ignorePatterns = [
  "build/**",
  "coverage/**",
  "public/r/**",
  ".react-router/**",
  ".source/**",
  ".github/badges/**",
  "playwright-report/**",
  "test-results/**",
]

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  // GitHub Pages serves the project under its name, the router knows it as its basename.
  base: "/browser-ai/",
  // The docs plugins stay out of the test run, which renders the registry on its own.
  plugins: process.env.VITEST
    ? []
    : [
        // The props tables are generated from the types at build time.
        fumadocsMdx({ globalOptions: { mdxOptions: { remarkPlugins: [remarkAutoTypeTable] } } }),
        tailwindcss(),
        reactRouter(),
      ],
  resolve: {
    alias: [
      // The examples import the registry the way a project that installed it does.
      {
        find: "@/components/ui/speech-input",
        replacement: here("registry/new-york/ui/speech-input.tsx"),
      },
      {
        find: "@/hooks/use-speech-to-text",
        replacement: here("registry/new-york/hooks/use-speech-to-text.ts"),
      },
      { find: "@", replacement: here(".") },
    ],
  },
  // The worker imports onnxruntime-web, which Vite must not pre-bundle into a classic script.
  worker: { format: "es" },

  // The style of shadcn/ui, because the registry files land in shadcn projects.
  fmt: {
    semi: false,
    singleQuote: false,
    printWidth: 100,
    trailingComma: "es5",
    tabWidth: 2,
    ignorePatterns,
  },
  lint: {
    ignorePatterns,
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    // The registry lands in other projects and is linted there. The recommended rules of
    // typescript-eslint reject `any`, and those of react-hooks 7, as Next.js 16 sets them
    // up, the rules of React's compiler: errors here too, so a file that breaks one fails.
    overrides: [
      {
        files: ["registry/**"],
        plugins: ["react", "typescript", "unicorn", "oxc"],
        rules: {
          "typescript/no-explicit-any": "error",
          "react/refs": "error",
          "react/purity": "error",
          "react/immutability": "error",
          "react/set-state-in-effect": "error",
        },
      },
      // `act` of React returns a thenable even for a synchronous callback.
      { files: ["tests/**"], rules: { "typescript/no-floating-promises": "off" } },
    ],
    options: { typeAware: true, typeCheck: true },
  },

  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      include: ["registry/**/*.{ts,tsx}"],
      // The registry is the code that lands in other projects: `pnpm coverage` fails below this.
      thresholds: { statements: 98, branches: 98, functions: 98, lines: 98 },
    },
  },
})
