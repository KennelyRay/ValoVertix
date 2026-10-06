import { useEffect } from "react";
import { queryClient } from "@/lib/query-client";
import { demoTokens, startDemoWorker, stopDemoWorker } from "@/lib/demo";
import { useSessionStore } from "./session-store";

/** Starts demo mode: MSW worker + a fictional account served from fixtures. */
export async function startDemo() {
  await startDemoWorker();
  // Loaded on demand: connect pulls in the Riot client and its schemas.
  const { connectAccount } = await import("./connect");
  const result = await connectAccount(demoTokens(), { demo: true, shard: "ap" });
  if (result.status !== "ok") throw new Error("demo connect failed");
  await useSessionStore.getState().addSession({ ...result.session, shardPicked: false });
}

/** Real sign-in must never be answered by the demo worker. */
export async function leaveDemo() {
  stopDemoWorker();
  const { sessions, forget } = useSessionStore.getState();
  for (const s of sessions.filter((x) => x.demo)) {
    queryClient.removeQueries({ queryKey: ["riot", s.id] });
    await forget(s.id);
  }
}

export async function forgetAccount(id: string) {
  await queryClient.cancelQueries({ queryKey: ["riot", id] });
  queryClient.removeQueries({ queryKey: ["riot", id] });
  const session = useSessionStore.getState().sessions.find((s) => s.id === id);
  await useSessionStore.getState().forget(id);
  if (session?.demo && !useSessionStore.getState().sessions.some((s) => s.demo)) stopDemoWorker();
}

/** Signs a session out the moment its token expires. Never refreshes or retries. */
export function useExpiryWatcher() {
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      for (const s of useSessionStore.getState().sessions) {
        if (s.expiresAt <= now) {
          void queryClient.cancelQueries({ queryKey: ["riot", s.id] });
          queryClient.removeQueries({ queryKey: ["riot", s.id] });
          void useSessionStore.getState().endSession(s.id, "expired");
        }
      }
    };
    check();
    const timer = setInterval(check, 1000);
    return () => clearInterval(timer);
  }, []);
}
