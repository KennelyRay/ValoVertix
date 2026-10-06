import { render } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { LazyMotion, MotionConfig, domMax } from "framer-motion";
import { parseAccessUrl } from "@valovertix/riot";
import { fakeAccessUrl } from "@valovertix/riot/test-utils";
import { connectAccount } from "@/features/auth/connect";
import { useSessionStore } from "@/features/auth/session-store";
import { useSettings } from "@/features/settings-store";
import { queryClient } from "@/lib/query-client";
import { createAppRouter } from "@/router";

export function testTokens(ttlSeconds = 3600) {
  const parsed = parseAccessUrl(fakeAccessUrl({ exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  if (!parsed.ok) throw new Error("bad test tokens");
  return parsed.tokens;
}

/** Connects the fixture account through the real sign-in code, answered by MSW. */
export async function signInFixtureAccount(opts: { remember?: boolean } = {}) {
  const result = await connectAccount(testTokens(), opts);
  if (result.status !== "ok") throw new Error("expected a session");
  await useSessionStore.getState().addSession(result.session);
  return result.session;
}

export function resetApp() {
  queryClient.clear();
  useSessionStore.getState().reset();
  useSessionStore.setState({ booting: false });
  useSettings.setState({
    hideFreeSkins: true,
    includeAgents: false,
    motion: "system",
    backdropArt: true,
    showRiotIdOnShare: false,
  });
}

export function renderApp(path: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  const utils = render(
    <MotionConfig reducedMotion="always">
      <LazyMotion features={domMax} strict>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </LazyMotion>
    </MotionConfig>,
  );
  return { ...utils, router };
}
