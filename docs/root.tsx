import { RootProvider } from "fumadocs-ui/provider/react-router"
import type { Framework } from "fumadocs-core/framework"
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router"

import NotFound from "./routes/not-found"
import type { Route } from "./+types/root"
import "@fontsource-variable/geist"
import "@fontsource-variable/geist-mono"
import "./app.css"

// The cube of the registry's entry in the shadcn directory.
export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: `${import.meta.env.BASE_URL}favicon.svg` },
]

// Fumadocs' own Link, with a view transition between the pages of the docs.
const TransitionLink: Framework["Link"] = ({ href, prefetch, ...props }) => (
  <Link to={href ?? ""} prefetch={prefetch ? "intent" : "none"} viewTransition {...props} />
)

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="flex min-h-screen flex-col">
        <RootProvider
          components={{ Link: TransitionLink }}
          search={{ options: { type: "static", api: "/browser-ai/api/search" } }}
        >
          {children}
        </RootProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />
  return (
    <main className="mx-auto w-full max-w-[1400px] p-4 pt-16">
      <h1>Error</h1>
      <p>{error instanceof Error ? error.message : "An unexpected error occurred."}</p>
    </main>
  )
}
