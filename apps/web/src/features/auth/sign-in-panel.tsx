import { useId, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import {
  ACCESS_URL_ERROR_MESSAGES,
  DEFAULT_SHARD,
  RIOT_AUTHORIZE_URL,
  SHARDS,
  SHARD_LABELS,
  parseAccessUrl,
  type AccessTokens,
  type Shard,
} from "@valovertix/riot";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { cn } from "@/lib/cn";
import { toast } from "@/components/toast";
import { connectErrorMessage } from "./connect-errors";
import { leaveDemo } from "./actions";
import { useSessionStore } from "./session-store";

export function SignInPanel({
  onDone,
  compact = false,
}: {
  onDone?: () => void;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const addSession = useSessionStore((s) => s.addSession);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingTokens, setPendingTokens] = useState<AccessTokens | null>(null);
  const [shard, setShard] = useState<Shard>(DEFAULT_SHARD);
  const ids = { url: useId(), remember: useId(), err: useId(), region: useId() };

  async function finish(tokens: AccessTokens, pickedShard?: Shard) {
    setBusy(true);
    setError(null);
    try {
      await leaveDemo();
      // Loaded on demand so the Riot client stays out of the first page load.
      const { connectAccount } = await import("./connect");
      const result = await connectAccount(tokens, {
        remember,
        ...(pickedShard && { shard: pickedShard }),
      });
      if (result.status === "needs_region") {
        setPendingTokens(result.tokens);
        return;
      }
      setPendingTokens(null);
      await addSession(result.session);
      toast.success(
        result.session.riotId ? `Signed in as ${result.session.riotId.gameName}` : "Signed in",
      );
      onDone?.();
      void navigate({ to: "/dashboard" });
    } catch (err) {
      setPendingTokens(null);
      setError(connectErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const input = inputRef.current;
    const value = input?.value ?? "";
    // The URL is a live credential: clear the field whatever happens next.
    if (input) input.value = "";
    const parsed = parseAccessUrl(value);
    if (!parsed.ok) {
      setError(ACCESS_URL_ERROR_MESSAGES[parsed.error]);
      input?.focus();
      return;
    }
    void finish(parsed.tokens);
  }

  if (pendingTokens) {
    return (
      <div className="space-y-4">
        <p className="text-muted">
          Riot didn't tell us which region your account plays in. Pick it to continue.
        </p>
        <Dropdown
          label="Region"
          value={shard}
          options={SHARDS.map((s) => ({ value: s, label: SHARD_LABELS[s] }))}
          onChange={setShard}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => void finish(pendingTokens, shard)}
          >
            {busy ? "Connecting…" : "Continue with this region"}
          </Button>
          <Button variant="ghost" onClick={() => setPendingTokens(null)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" aria-busy={busy}>
      <ol className="space-y-5">
        <li className="flex gap-3">
          <span aria-hidden className="font-display text-2xl font-bold leading-none text-muted">
            1
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="font-medium">Sign in on Riot's page</p>
            {!compact && (
              <p className="text-sm text-muted">
                It opens in a new tab. You type your password there, never here.
              </p>
            )}
            <a
              href={RIOT_AUTHORIZE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              Sign in with Riot
              <ExternalLink aria-hidden className="size-4" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        </li>
        <li className="flex gap-3">
          <span aria-hidden className="font-display text-2xl font-bold leading-none text-muted">
            2
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor={ids.url} className="block font-medium">
              Paste the address Riot sends you to
            </label>
            {!compact && (
              <p className="text-sm text-muted">
                After signing in you land on a playvalorant.com page. Copy the full address from the
                address bar.
              </p>
            )}
            <textarea
              ref={inputRef}
              id={ids.url}
              rows={2}
              required
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="https://playvalorant.com/opt_in#access_token=…"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? ids.err : undefined}
              className="block w-full resize-none border border-line-strong bg-bg px-3 py-2 font-mono text-sm break-all placeholder:text-faint"
            />
            {error && (
              <p id={ids.err} role="alert" className="text-sm text-loss">
                {error}
              </p>
            )}
          </div>
        </li>
      </ol>

      <div className="flex items-start gap-3 border-t border-line pt-4">
        <input
          id={ids.remember}
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="mt-1 size-5 shrink-0 accent-[var(--color-accent)]"
        />
        <label htmlFor={ids.remember} className="text-sm">
          <span className="font-medium">Remember this account on this device</span>
          <span className="block text-muted">
            Stored encrypted until the token expires (about an hour). This stops casual snooping,
            not malware or other people using this browser profile.
          </span>
        </label>
      </div>

      <Button type="submit" variant="primary" disabled={busy} className="w-full sm:w-auto">
        {busy ? "Connecting to Riot…" : "Show my account"}
      </Button>
    </form>
  );
}
