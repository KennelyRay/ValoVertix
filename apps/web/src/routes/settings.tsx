import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SHARD_LABELS } from "@valovertix/riot";
import { DemoButton, PageHeader } from "@/components/shared";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Dialog, EmptyNote, Panel, Switch } from "@/components/ui/primitives";
import { Dropdown } from "@/components/ui/dropdown";
import { VP_PRICES } from "@/config/vp-prices";
import { ExpiryIndicator, accountLabel } from "@/features/auth/account-bar";
import { forgetAccount } from "@/features/auth/actions";
import { useSessionStore } from "@/features/auth/session-store";
import { SignInPanel } from "@/features/auth/sign-in-panel";
import { useSettings } from "@/features/settings-store";
import { clearAllData } from "@/lib/clear-data";

function Accounts() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeId);
  const setActive = useSessionStore((s) => s.setActive);
  const [adding, setAdding] = useState(false);

  return (
    <Panel aria-labelledby="accounts-title" className="panel-raised">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="accounts-title" className="text-2xl">
          Connected accounts
        </h2>
        <Button onClick={() => setAdding(true)}>Add an account</Button>
      </div>
      {sessions.length === 0 ? (
        <div className="mt-4">
          <EmptyNote title="No accounts connected">
            Sign in with Riot to connect one, or try the demo.
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="primary" onClick={() => setAdding(true)}>
                Connect an account
              </Button>
              <DemoButton />
            </div>
          </EmptyNote>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {accountLabel(s)}
                  {s.id === activeId && <span className="ml-2 text-sm text-muted">(viewing)</span>}
                </p>
                <p className="flex flex-wrap gap-x-3 text-sm text-muted">
                  <ExpiryIndicator session={s} />
                  <span>{SHARD_LABELS[s.shard]}</span>
                  <span>
                    {s.demo ? "Demo" : s.remembered ? "Remembered, encrypted" : "This tab only"}
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                {s.id !== activeId && (
                  <Button size="sm" onClick={() => setActive(s.id)}>
                    View
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    await forgetAccount(s.id);
                    toast.info(`${accountLabel(s)} removed from this device.`);
                  }}
                >
                  Forget<span className="sr-only"> {accountLabel(s)}</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={adding} onClose={() => setAdding(false)} title="Add a Riot account">
        <SignInPanel compact onDone={() => setAdding(false)} />
      </Dialog>
    </Panel>
  );
}

function Preferences() {
  const s = useSettings();
  return (
    <Panel aria-labelledby="prefs-title">
      <h2 id="prefs-title" className="text-2xl">
        Preferences
      </h2>
      <div className="mt-3 divide-y divide-line">
        <Switch
          checked={s.hideFreeSkins}
          onChange={(v) => s.set({ hideFreeSkins: v })}
          label="Hide free skins in the collection"
          description="Battle pass, contract and other no-tier rewards."
        />
        <Switch
          checked={s.hideFreeBundles}
          onChange={(v) => s.set({ hideFreeBundles: v })}
          label="Hide battle pass and free collections"
          description="In the Bundles tab, collections where every skin came from a battle pass, contract or event."
        />
        <Switch
          checked={s.backdropArt}
          onChange={(v) => s.set({ backdropArt: v })}
          label="Background art"
          description="Your featured bundle (or map art when signed out) behind the page. Turn off to save data."
        />
        <Switch
          checked={s.motion === "reduce"}
          onChange={(v) => s.set({ motion: v ? "reduce" : "system" })}
          label="Reduce motion"
          description="Turns off animations. Your system setting is always respected too."
        />
        <div className="max-w-xs space-y-2 py-3">
          <Dropdown
            label="Currency"
            value={s.currency}
            options={(Object.keys(VP_PRICES) as (keyof typeof VP_PRICES)[]).map((code) => ({
              value: code,
              label: `${code} (${VP_PRICES[code].symbol})`,
            }))}
            onChange={(code) => s.set({ currency: code })}
          />
          <p className="text-sm text-muted">Peso is the only currency with pack prices so far.</p>
        </div>
      </div>
    </Panel>
  );
}

function DangerZone() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  return (
    <Panel aria-labelledby="clear-title">
      <h2 id="clear-title" className="text-2xl">
        Clear all data
      </h2>
      <p className="mt-2 max-w-2xl text-muted">
        Removes every account, the encryption key, cached game data and your preferences from this
        browser. Use this on a shared computer.
      </p>
      <Button variant="danger" className="mt-4" onClick={() => setConfirming(true)}>
        Clear all data
      </Button>
      <Dialog open={confirming} onClose={() => setConfirming(false)} title="Clear everything?">
        <p>
          All connected accounts are signed out here and every stored item is deleted. This can't be
          undone.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await clearAllData();
              setBusy(false);
              setConfirming(false);
              toast.success("All ValoVertix data was removed from this browser.");
              void navigate({ to: "/" });
            }}
          >
            {busy ? "Clearing…" : "Yes, clear everything"}
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Keep my data
          </Button>
        </div>
      </Dialog>
    </Panel>
  );
}

export default function SettingsRoute() {
  return (
    <>
      <PageHeader title="Accounts and settings">Manage what this browser keeps.</PageHeader>
      <div className="reveal-children space-y-6">
        <Accounts />
        <Preferences />
        <DangerZone />
      </div>
    </>
  );
}
