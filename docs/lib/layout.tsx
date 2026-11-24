import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"

export const githubUrl = "https://github.com/niekes/browser-ai"

export function baseOptions(): BaseLayoutProps {
  return {
    nav: { title: "browser-ai" },
    githubUrl,
    links: [{ text: "Sponsor", url: "https://github.com/sponsors/niekes", external: true }],
  }
}
