import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  type ErrorComponentProps,
  type RouterHistory,
} from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ErrorNote } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import Landing from "@/routes/landing";

function RouteError({ reset }: ErrorComponentProps) {
  return (
    <ErrorNote
      title="This page hit an error."
      action={
        <Button onClick={reset} size="sm">
          Try again
        </Button>
      }
    >
      Nothing was sent anywhere. Reload the page if it keeps happening.
    </ErrorNote>
  );
}

function NotFound() {
  return (
    <div className="py-16">
      <h1 className="text-4xl">Page not found</h1>
      <p className="mt-2 text-muted">That address doesn't exist in ValoVertix.</p>
    </div>
  );
}

const rootRoute = createRootRoute({
  component: AppShell,
  errorComponent: RouteError,
  notFoundComponent: NotFound,
});

const page = (path: string, load: () => Promise<{ default: React.ComponentType }>) =>
  createRoute({ getParentRoute: () => rootRoute, path, component: lazyRouteComponent(load) });

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: "/", component: Landing }),
  page("/dashboard", () => import("@/routes/dashboard")),
  page("/store", () => import("@/routes/store")),
  page("/collection", () => import("@/routes/collection")),
  page("/spending", () => import("@/routes/spending")),
  page("/stats", () => import("@/routes/stats")),
  page("/share", () => import("@/routes/share")),
  page("/settings", () => import("@/routes/settings")),
  page("/guide", () => import("@/routes/guide")),
  page("/privacy", () => import("@/routes/privacy")),
  page("/terms", () => import("@/routes/terms")),
]);

export const createAppRouter = (history?: RouterHistory) =>
  createRouter({
    routeTree,
    ...(history && { history }),
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultErrorComponent: RouteError,
  });

export const router = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
