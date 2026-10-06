import { useLayoutEffect, useRef, useState } from "react";
import { PageHeader, RequireSession } from "@/components/shared";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Panel, Switch } from "@/components/ui/primitives";
import { useActiveSession } from "@/features/auth/session-store";
import { useLoadout, useMatchStats, useRanks, useSpending, useStatic } from "@/features/data";
import { useSettings } from "@/features/settings-store";
import {
  SIZES,
  ShareCard,
  type CardData,
  type SizeKey,
  type Template,
} from "@/features/share/cards";
import { downloadBlob, exportPng } from "@/features/share/export";
import { cn } from "@/lib/cn";

const TEMPLATES: { id: Template; label: string }[] = [
  { id: "spending", label: "Spending summary" },
  { id: "collection", label: "Collection showcase" },
  { id: "rank", label: "Rank card" },
];

function Share() {
  const session = useActiveSession()!;
  const [template, setTemplate] = useState<Template>("spending");
  const [size, setSize] = useState<SizeKey>("square");
  const showRiotId = useSettings((s) => s.showRiotIdOnShare);
  const setSettings = useSettings((s) => s.set);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  const sp = useSpending();
  const ranks = useRanks();
  const matches = useMatchStats(10);
  const loadout = useLoadout();
  const cards = useStatic("playerCards");
  const art =
    cards.data?.find((c) => c.uuid.toLowerCase() === loadout.data?.PlayerCardID.toLowerCase())
      ?.wideArt ?? null;

  const dims = SIZES[size];
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / dims.w, 640 / dims.h));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dims.w, dims.h]);

  const data: CardData = {
    riotId:
      showRiotId && session.riotId ? `${session.riotId.gameName}#${session.riotId.tagLine}` : null,
    spending: sp.spending,
    money: sp.money,
    currencyFormat: sp.currency.format,
    totalSkins: sp.owned?.length ?? 0,
    tierById: sp.tierById,
    current: ranks.current,
    peak: ranks.peak,
    tiers: ranks.tiers,
    aggregate: matches.aggregate.games ? matches.aggregate : null,
    cardArt: art,
  };
  const ready = template === "rank" ? !ranks.mmr.isPending : Boolean(sp.spending);

  async function onExport() {
    const node = cardRef.current?.querySelector<HTMLElement>("[data-share-card] > div");
    if (!node) return;
    setBusy(true);
    try {
      const blob = await exportPng(node, dims.w, dims.h);
      downloadBlob(blob, `valovertix-${template}-${dims.w}x${dims.h}.png`);
      toast.success("PNG saved to your downloads.");
    } catch {
      toast.error("Couldn't create the image. An artwork may have failed to load; try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <Panel aria-label="Card options" className="h-fit space-y-5">
        <fieldset>
          <legend className="mb-2 font-display text-lg font-semibold">Template</legend>
          <div className="space-y-1">
            {TEMPLATES.map((t) => (
              <label key={t.id} className="flex min-h-11 cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="template"
                  value={t.id}
                  checked={template === t.id}
                  onChange={() => setTemplate(t.id)}
                  className="size-5 accent-[var(--color-accent)]"
                />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 font-display text-lg font-semibold">Size</legend>
          <div className="space-y-1">
            {(Object.keys(SIZES) as SizeKey[]).map((k) => (
              <label key={k} className="flex min-h-11 cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="size"
                  value={k}
                  checked={size === k}
                  onChange={() => setSize(k)}
                  className="size-5 accent-[var(--color-accent)]"
                />
                {SIZES[k].label}
              </label>
            ))}
          </div>
        </fieldset>
        <Switch
          checked={showRiotId}
          onChange={(v) => setSettings({ showRiotIdOnShare: v })}
          label="Show my Riot ID"
          description="Off by default. Your account ID and token are never on the image."
        />
        <Button
          variant="primary"
          className="w-full"
          disabled={busy || !ready}
          onClick={() => void onExport()}
        >
          {busy ? "Creating PNG…" : !ready ? "Loading data…" : "Download PNG"}
        </Button>
      </Panel>

      <div ref={frameRef} className="min-w-0">
        <p className="mb-2 text-sm text-muted">
          Preview at {Math.round(scale * 100)}%. The download is {dims.w} × {dims.h} pixels.
        </p>
        <div
          className={cn("relative overflow-hidden border border-line")}
          style={{ width: dims.w * scale, height: dims.h * scale }}
        >
          <div
            ref={cardRef}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              width: dims.w,
              height: dims.h,
            }}
          >
            <ShareCard template={template} size={size} data={data} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ShareRoute() {
  return (
    <RequireSession title="Share card">
      <PageHeader title="Share card">
        Make a PNG of your spending, collection or rank to post anywhere.
      </PageHeader>
      <Share />
    </RequireSession>
  );
}
