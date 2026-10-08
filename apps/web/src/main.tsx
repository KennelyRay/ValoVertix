// Must run before any other module touches the DOM.
import "./lib/trusted-types";
import "@fontsource/rajdhani/latin-600.css";
import "@fontsource/rajdhani/latin-700.css";
import "@fontsource-variable/inter/wght.css";
import "./styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { LazyMotion, MotionConfig, domMax } from "framer-motion";
import { useSessionStore } from "@/features/auth/session-store";
import { startDemo } from "@/features/auth/actions";
import { useSettings } from "@/features/settings-store";
import { isDemoFlagged, startDemoWorker } from "@/lib/demo";
import { queryClient } from "@/lib/query-client";
import { scrubCredentialsFromUrl } from "@/lib/url-guard";
import { router } from "@/router";

function App() {
  const motion = useSettings((s) => s.motion);
  return (
    <MotionConfig reducedMotion={motion === "reduce" ? "always" : "user"}>
      <LazyMotion features={domMax} strict>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </LazyMotion>
    </MotionConfig>
  );
}

async function boot() {
  // First thing: a sign-in token in our own URL is removed before anything else runs.
  scrubCredentialsFromUrl();
  const url = new URL(window.location.href);
  const wantsDemo = url.searchParams.get("demo") === "1";
  if (wantsDemo) {
    url.searchParams.delete("demo");
    window.history.replaceState(
      null,
      "",
      url.pathname === "/" ? "/dashboard" : url.pathname + url.search,
    );
  }

  // Paint the shell right away; pages show skeletons until boot finishes.
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  const store = useSessionStore.getState();
  await store.hydrate();
  if (wantsDemo || isDemoFlagged()) {
    try {
      const hasDemo = useSessionStore.getState().sessions.some((s) => s.demo);
      // The worker must be running before any demo session renders and fetches.
      if (hasDemo) await startDemoWorker();
      else if (wantsDemo) await startDemo();
      else await startDemoWorker();
    } catch {
      // Service workers can be blocked (private mode, browser settings). Fall back to sign-in.
    }
  }
  store.setBooting(false);
}

void boot();
