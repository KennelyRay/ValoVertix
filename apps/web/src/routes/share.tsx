import {
  useCallback,
  useDeferredValue,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CatalogSkin } from "@valovertix/assets";
import { indexBy } from "@valovertix/assets";
import { countBy } from "@valovertix/calc";
import { PageHeader, RequireSession } from "@/components/shared";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { Dialog, Panel, Switch, Tabs } from "@/components/ui/primitives";
import { useActiveSession } from "@/features/auth/session-store";
import { useBundles } from "@/features/collection/bundles";
import { useEquippedGuns, type EquippedGun } from "@/features/collection/loadout";
import { useProfile } from "@/features/dashboard/profile";
import { useMatchStats, useRanks, useSpending, useStatic, useStorefront } from "@/features/data";
import { useSettings } from "@/features/settings-store";
import { ShareLinkPanel } from "@/features/share/link-panel";
import {
  ACCENTS,
  SIZES,
  LOADOUT_SLOTS,
  SKIN_SLOTS,
  ShareCard,
  type CardData,
  type AccentKey,
  type CardSkin,
  type SizeKey,
  type Template,
} from "@/features/share/cards";
import { downloadBlob, exportPng } from "@/features/share/export";
import { cn } from "@/lib/cn";
import { useRememberedTab } from "@/lib/use-remembered-tab";
import { useMedia } from "@/lib/use-media";
import { createPortal } from "react-dom";
import { apiColor } from "@/lib/format";

/** Which equipped skins make the loadout card when not all fit: the most-used guns first. */
const LOADOUT_PRIORITY = [
  "vandal",
  "phantom",
  "melee",
  "operator",
  "sheriff",
  "ghost",
  "classic",
  "spectre",
  "marshal",
  "guardian",
  "bulldog",
  "outlaw",
  "odin",
  "ares",
  "judge",
  "bucky",
  "stinger",
  "frenzy",
  "shorty",
  "bandit",
];

const TEMPLATES: { id: Template; label: string; text: string }[] = [
  { id: "locker", label: "Locker", text: "Your best skins in a grid" },
  { id: "collection", label: "Collection", text: "Every paid skin, 20 per story card" },
  { id: "spending", label: "Spending", text: "Estimated value and top skins" },
  { id: "profile", label: "Profile", text: "Player card, rank and stats" },
  { id: "rank", label: "Rank", text: "Rank, RR and recent results" },
  { id: "loadout", label: "Loadout", text: "The skins you have equipped" },
];

type SkinMode = "value" | "tier" | "picked";
type Order = "value" | "tier" | "weapon" | "name";

function loadoutForCard(guns: EquippedGun[], slots: number) {
  const skinned = guns.filter((g) => !g.isDefault && g.skin);
  const rank = (g: EquippedGun) => {
    const i = LOADOUT_PRIORITY.indexOf(g.weapon.displayName.toLowerCase());
    return i === -1 ? LOADOUT_PRIORITY.length : i;
  };
  const keep = new Set([...skinned].sort((a, b) => rank(a) - rank(b)).slice(0, slots));
  return skinned.filter((g) => keep.has(g));
}
type Background = "card" | "bundle" | "none";

function SkinPicker({
  open,
  onClose,
  skins,
  picked,
  setPicked,
  limit,
}: {
  open: boolean;
  onClose: () => void;
  skins: CatalogSkin[];
  picked: string[];
  setPicked: (ids: string[]) => void;
  limit: number;
}) {
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());
  const id = useId();
  const visible = skins.filter((s) => !q || s.name.toLowerCase().includes(q));
  const toggle = (uuid: string) => {
    if (picked.includes(uuid)) setPicked(picked.filter((p) => p !== uuid));
    else if (picked.length < limit) setPicked([...picked, uuid]);
  };
  return (
    <Dialog side open={open} onClose={onClose} title="Choose skins">
      <div className="space-y-4">
        <p className="text-sm text-muted" aria-live="polite">
          {picked.length} of {limit} picked. They appear on the card in the order you pick them.
        </p>
        <div>
          <label
            htmlFor={id}
            className="mb-1 block font-display text-xs font-semibold uppercase tracking-[0.08em] text-muted"
          >
            Search your skins
          </label>
          <input
            id={id}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Skin name, e.g. Reaver"
            className="min-h-11 w-full border border-line-strong bg-bg/70 px-3 placeholder:text-faint"
          />
        </div>
        <ul className="grid grid-cols-2 gap-2">
          {visible.map((s) => {
            const index = picked.indexOf(s.uuid);
            const on = index >= 0;
            const full = !on && picked.length >= limit;
            return (
              <li key={s.uuid}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={full}
                  onClick={() => toggle(s.uuid)}
                  className={cn(
                    "relative flex h-full w-full flex-col items-center gap-1 border p-2 text-center text-xs transition-colors",
                    on ? "border-accent bg-accent/10" : "border-line hover:border-line-strong",
                    full && "opacity-40",
                  )}
                >
                  {on && (
                    <span className="absolute left-1.5 top-1.5 grid size-6 place-items-center bg-accent font-display text-sm font-bold text-accent-ink">
                      {index + 1}
                    </span>
                  )}
                  {s.icon && (
                    <img
                      src={s.icon}
                      alt=""
                      loading="lazy"
                      className="h-12 w-full object-contain"
                    />
                  )}
                  <span className="line-clamp-2">{s.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="sticky bottom-0 flex gap-2 border-t border-line bg-surface py-3">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
          <Button variant="ghost" onClick={() => setPicked([])} disabled={picked.length === 0}>
            Clear
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function Share() {
  const session = useActiveSession()!;
  const [template, setTemplate] = useRememberedTab<Template>(
    "share",
    "locker",
    TEMPLATES.map((x) => x.id),
  );
  const [size, setSize] = useState<SizeKey>("square");
  const [background, setBackground] = useState<Background>("card");
  const [mode, setMode] = useState<SkinMode>("value");
  const [picked, setPicked] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [order, setOrder] = useState<Order>("value");
  const [page, setPage] = useState(0);
  const compact = useMedia("(max-width: 1023px)");
  const [shareMode, setShareMode] = useRememberedTab<ShareMode>("share-mode", "image", [
    "image",
    "link",
  ]);
  const [accent, setAccent] = useState<AccentKey>("red");
  const [headline, setHeadline] = useState("");
  const [showPrices, setShowPrices] = useState(true);
  const [tilt, setTilt] = useState(true);
  const [showTierBar, setShowTierBar] = useState(true);
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);
  const headlineId = useId();
  const showRiotId = useSettings((s) => s.showRiotIdOnShare);
  const setSettings = useSettings((s) => s.set);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  const sp = useSpending();
  const ranks = useRanks();
  const matches = useMatchStats(10);
  const profile = useProfile();
  const equipped = useEquippedGuns();
  const storefront = useStorefront(true);
  const bundles = useStatic("bundles", Boolean(storefront.data?.bundles.length));

  const dims = SIZES[size];
  const slots = SKIN_SLOTS[template][size];

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    // Fit the stage width (minus its padding) and keep tall cards to about 640px.
    const update = () =>
      setScale(Math.max(0.1, Math.min(1, (el.clientWidth - 48) / dims.w, 640 / dims.h)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dims.w, dims.h, shareMode]);

  const priceBySkin = useMemo(
    () => new Map(sp.spending?.priced.map((p) => [p.owned.skin.uuid, p.vp]) ?? []),
    [sp.spending],
  );

  // Skins a player would want to show: tiered, not battle pass freebies.
  const showable = useMemo(
    () => (sp.owned ?? []).map((o) => o.skin).filter((s) => s.tierId && !s.isContractReward),
    [sp.owned],
  );

  const tierRank = useCallback(
    (s: CatalogSkin) => (s.tierId ? (sp.tierById.get(s.tierId)?.rank ?? -1) : -1),
    [sp.tierById],
  );

  // The Collection template: every paid skin, in the chosen order, split into cards.
  const paidSorted = useMemo(() => {
    const price = (s: CatalogSkin) => priceBySkin.get(s.uuid) ?? -1;
    const list = [...showable];
    if (order === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (order === "weapon")
      list.sort((a, b) => a.weaponName.localeCompare(b.weaponName) || a.name.localeCompare(b.name));
    else if (order === "tier")
      list.sort((a, b) => tierRank(b) - tierRank(a) || price(b) - price(a));
    else list.sort((a, b) => price(b) - price(a) || tierRank(b) - tierRank(a));
    return list;
  }, [showable, order, priceBySkin, tierRank]);
  const pageCount = Math.max(1, Math.ceil(paidSorted.length / SKIN_SLOTS.collection[size]));
  const pageIndex = Math.min(page, pageCount - 1);

  const cardSkins = useMemo<CardSkin[]>(() => {
    if (slots === 0) return [];
    const price = (s: CatalogSkin) => priceBySkin.get(s.uuid);
    if (template === "collection") {
      return paidSorted
        .slice(pageIndex * slots, (pageIndex + 1) * slots)
        .map((skin) => ({ skin, vp: price(skin) }));
    }
    const byId = new Map(showable.map((s) => [s.uuid, s]));
    let list: CatalogSkin[];
    if (mode === "picked" && picked.length) {
      list = picked.map((id) => byId.get(id)).filter((s): s is CatalogSkin => Boolean(s));
    } else if (mode === "tier") {
      list = [...showable].sort(
        (a, b) => tierRank(b) - tierRank(a) || (price(b) ?? 0) - (price(a) ?? 0),
      );
    } else {
      list = [...showable].sort(
        (a, b) => (price(b) ?? -1) - (price(a) ?? -1) || tierRank(b) - tierRank(a),
      );
    }
    return list.slice(0, slots).map((skin) => ({ skin, vp: price(skin) }));
  }, [slots, template, paidSorted, pageIndex, showable, mode, picked, priceBySkin, tierRank]);

  const tierCounts = useMemo(() => {
    const counts = countBy(sp.owned ?? [], (o) => o.skin.tierId);
    return [...sp.tiers]
      .sort((a, b) => b.rank - a.rank)
      .map((tier) => ({ tier, count: counts.get(tier.uuid.toLowerCase()) ?? 0 }))
      .filter((t) => t.count > 0);
  }, [sp.owned, sp.tiers]);

  const bundleArt = useMemo(() => {
    const index = indexBy(bundles.data ?? []);
    const first = storefront.data?.bundles[0];
    return first ? (index.get(first.dataAssetId)?.displayIcon ?? null) : null;
  }, [bundles.data, storefront.data]);

  const cardArt = (variant: "tall" | "wide") => {
    const fromCatalog = variant === "tall" ? profile.card?.largeArt : profile.card?.wideArt;
    const file = variant === "tall" ? "largeart" : "wideart";
    return (
      fromCatalog ??
      (profile.cardId
        ? `https://media.valorant-api.com/playercards/${profile.cardId}/${file}.png`
        : null)
    );
  };

  const recent = useMemo(
    () => [...matches.details.summaries].sort((a, b) => b.startedAt - a.startedAt).slice(0, 10),
    [matches.details.summaries],
  );

  const data: CardData = {
    riotId:
      showRiotId && session.riotId ? `${session.riotId.gameName}#${session.riotId.tagLine}` : null,
    title: showRiotId ? (profile.title?.titleText ?? null) : null,
    level: profile.level ?? null,
    levelBorder: profile.border,
    cardArtTall: cardArt("tall"),
    background:
      background === "card"
        ? cardArt(size === "story" ? "tall" : "wide")
        : background === "bundle"
          ? bundleArt
          : null,
    skins: cardSkins,
    totalSkins: sp.owned?.length ?? 0,
    tierCounts,
    tierById: sp.tierById,
    spending: sp.spending,
    money: sp.money,
    formatMoney: sp.pricing.fmtRange,
    pricingRegion: sp.pricing.region.label,
    tierPriced: sp.priceSource === "tier",
    current: ranks.current,
    peak: ranks.peak,
    tiers: ranks.tiers,
    recent,
    loadoutCount: (equipped.guns ?? []).filter((g) => !g.isDefault && g.skin).length,
    loadout: loadoutForCard(equipped.guns ?? [], LOADOUT_SLOTS[size]).map((g) => ({
      key: g.weapon.uuid,
      weapon: g.weapon.displayName,
      skin: g.skin!.name,
      image: g.image,
      color: apiColor(
        g.skin!.tierId ? equipped.tierById.get(g.skin!.tierId)?.highlightColor : undefined,
      ),
    })),
    accent: ACCENTS[accent].color,
    headline: headline.trim() || null,
    showPrices,
    tilt,
    showTierBar,
    page: { index: pageIndex, total: pageCount },
    paidCount: paidSorted.length,
  };

  const ready =
    template === "rank" || template === "profile"
      ? !ranks.mmr.isPending
      : template === "loadout"
        ? Boolean(equipped.guns)
        : Boolean(sp.owned && sp.spending);

  const fileName = (index = pageIndex) =>
    template === "collection" && pageCount > 1
      ? `valovertix-collection-${index + 1}-of-${pageCount}-${dims.w}x${dims.h}.png`
      : `valovertix-${template}-${dims.w}x${dims.h}.png`;
  const cardNode = () => cardRef.current?.querySelector<HTMLElement>("[data-share-card] > div");

  /** Renders each card of the set in turn and saves it. */
  async function onExportAll() {
    setBusy(true);
    const start = pageIndex;
    try {
      for (let i = 0; i < pageCount; i++) {
        setBatch({ done: i, total: pageCount });
        setPage(i);
        // Two frames: React commits the new page, then the browser lays it out.
        await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
        const node = cardNode();
        if (!node) throw new Error("no card");
        downloadBlob(await exportPng(node, dims.w, dims.h), fileName(i));
      }
      toast.success(`${pageCount} PNGs saved to your downloads.`);
    } catch {
      toast.error("Couldn't create every image. An artwork may have failed to load; try again.");
    } finally {
      setPage(start);
      setBatch(null);
      setBusy(false);
    }
  }

  async function onExport() {
    const node = cardNode();
    if (!node) return;
    setBusy(true);
    try {
      const blob = await exportPng(node, dims.w, dims.h);
      downloadBlob(blob, fileName());
      toast.success("PNG saved to your downloads.");
    } catch {
      toast.error("Couldn't create the image. An artwork may have failed to load; try again.");
    } finally {
      setBusy(false);
    }
  }

  const allSkins = useMemo(
    () => (sp.owned ?? []).map((o) => o.skin).filter((s) => !s.isDefault),
    [sp.owned],
  );
  const bundleRows = useBundles().rows;
  const counts = useMemo(
    () => ({
      totalSkins: allSkins.length,
      bundles: (bundleRows ?? []).filter((r) => !r.free && r.ownedCount >= r.total).length,
      battlePass: allSkins.filter((s) => s.isContractReward).length,
    }),
    [allSkins, bundleRows],
  );

  const downloadActions = (
    <div className="flex flex-wrap gap-2">
      {template === "collection" && pageCount > 1 && (
        <Button size="sm" disabled={busy || !ready} onClick={() => void onExportAll()}>
          {batch
            ? `Saving card ${batch.done + 1} of ${batch.total}…`
            : `Download all ${pageCount} cards`}
        </Button>
      )}
      <button
        type="button"
        className="btn-valo btn-valo-primary"
        disabled={busy || !ready}
        onClick={() => void onExport()}
      >
        {busy && !batch ? "Creating PNG…" : !ready ? "Loading data…" : "Download PNG"}
      </button>
    </div>
  );

  const sizeLabel: Record<SizeKey, string> = {
    square: "Square",
    story: "Story",
    wide: "Link preview",
  };
  const usesSkins = slots > 0;

  if (shareMode === "link") {
    return (
      <>
        <ModeSwitch mode={shareMode} setMode={setShareMode} />
        <div role="tabpanel" id="panel-link" aria-labelledby="tab-link">
          <ShareLinkPanel
            skins={showable}
            allSkins={allSkins}
            totalVp={sp.spending?.totalVp ?? null}
            counts={counts}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <ModeSwitch mode={shareMode} setMode={setShareMode} />
      <div
        role="tabpanel"
        id="panel-image"
        aria-labelledby="tab-image"
        className={cn(compact && "pb-20")}
      >
        <fieldset className="mb-6">
          <legend className={cn(SECTION, "mb-2")}>Template</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {TEMPLATES.map((t) => (
              <label
                key={t.id}
                className={cn(
                  "relative flex min-h-[4.5rem] cursor-pointer flex-col justify-center border px-3 py-2 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-text",
                  template === t.id
                    ? "border-accent bg-accent/10"
                    : "border-line-strong bg-surface/60 hover:border-muted",
                )}
              >
                <input
                  type="radio"
                  name="template"
                  value={t.id}
                  checked={template === t.id}
                  onChange={() => setTemplate(t.id)}
                  className="sr-only"
                />
                {template === t.id && (
                  <span aria-hidden className="absolute inset-x-3 top-0 h-[3px] bg-accent" />
                )}
                <span className="font-display text-lg font-bold uppercase leading-tight">
                  {t.label}
                </span>
                <span className="text-xs leading-snug text-muted">{t.text}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
          {/* The stage: the card at preview scale, with its actions on top. */}
          <section aria-label="Preview" className="panel min-w-0 p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <p className="text-sm text-muted">
                <span className="font-semibold text-text">
                  {dims.w} × {dims.h}
                </span>{" "}
                · preview at {Math.round(scale * 100)}%
              </p>
              {!compact && downloadActions}
            </div>
            <div
              ref={frameRef}
              className="flex min-w-0 justify-center bg-bg/60 p-4 sm:p-6"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(236,232,225,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(236,232,225,0.04) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            >
              <div
                className="relative shrink-0 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
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
            {template === "collection" && pageCount > 1 && (
              <div className="flex items-center justify-center gap-3 border-t border-line px-4 py-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pageIndex === 0 || busy}
                  onClick={() => setPage(pageIndex - 1)}
                >
                  Previous card
                </Button>
                <span className="text-sm tabular-nums" aria-live="polite">
                  Card {pageIndex + 1} of {pageCount}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pageIndex === pageCount - 1 || busy}
                  onClick={() => setPage(pageIndex + 1)}
                >
                  Next card
                </Button>
              </div>
            )}
          </section>

          <Panel aria-label="Card options" className="space-y-6">
            <section aria-labelledby="opt-format" className="space-y-4">
              <h2 id="opt-format" className={SECTION}>
                Format
              </h2>
              <Segmented<SizeKey>
                legend="Size"
                value={size}
                onChange={setSize}
                options={(Object.keys(SIZES) as SizeKey[]).map((k) => ({
                  value: k,
                  label: sizeLabel[k],
                  hint: `${SIZES[k].w}×${SIZES[k].h}`,
                }))}
              />
              <Dropdown<Background>
                label="Background"
                value={background}
                onChange={setBackground}
                options={[
                  { value: "card", label: "My player card" },
                  ...(bundleArt
                    ? [{ value: "bundle" as const, label: "Featured bundle art" }]
                    : []),
                  { value: "none", label: "Grid only" },
                ]}
              />
            </section>

            {template === "collection" && (
              <section aria-labelledby="opt-skins" className="space-y-3 border-t border-line pt-5">
                <h2 id="opt-skins" className={SECTION}>
                  Skins
                </h2>
                <Dropdown<Order>
                  label="Order"
                  value={order}
                  onChange={(o) => {
                    setOrder(o);
                    setPage(0);
                  }}
                  options={[
                    { value: "value", label: "Most valuable first" },
                    { value: "tier", label: "Highest tier first" },
                    { value: "weapon", label: "By weapon" },
                    { value: "name", label: "Name, A to Z" },
                  ]}
                />
                <Dropdown<string>
                  label={`Card (${pageCount} for ${paidSorted.length} paid skins)`}
                  value={String(pageIndex)}
                  onChange={(v) => setPage(Number(v))}
                  options={Array.from({ length: pageCount }, (_, i) => ({
                    value: String(i),
                    label: `Card ${i + 1}`,
                    hint: `${i * slots + 1}–${Math.min(paidSorted.length, (i + 1) * slots)}`,
                  }))}
                />
                <p className="text-xs text-muted">
                  Battle pass, contract and free skins are left out. Story size fits 20 per card.
                </p>
              </section>
            )}

            {usesSkins && template !== "collection" && (
              <section aria-labelledby="opt-skins" className="space-y-3 border-t border-line pt-5">
                <h2 id="opt-skins" className={SECTION}>
                  Skins
                </h2>
                <Dropdown<SkinMode>
                  label={`Skins on the card (${slots})`}
                  value={mode}
                  onChange={(m) => {
                    setMode(m);
                    if (m === "picked" && picked.length === 0) setPicking(true);
                  }}
                  options={[
                    { value: "value", label: "Most valuable" },
                    { value: "tier", label: "Highest tier" },
                    {
                      value: "picked",
                      label: "Picked by me",
                      ...(picked.length ? { hint: `${picked.length}` } : {}),
                    },
                  ]}
                />
                {mode === "picked" && (
                  <Button size="sm" onClick={() => setPicking(true)}>
                    {picked.length ? `Change picks (${picked.length})` : "Choose skins"}
                  </Button>
                )}
              </section>
            )}

            <section aria-labelledby="opt-style" className="space-y-4 border-t border-line pt-5">
              <h2 id="opt-style" className={SECTION}>
                Style
              </h2>
              <fieldset>
                <legend className={cn(SECTION, "mb-2 text-[0.7rem]")}>Accent color</legend>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(ACCENTS) as AccentKey[]).map((k) => (
                    <label
                      key={k}
                      title={ACCENTS[k].label}
                      className={cn(
                        "grid size-11 cursor-pointer place-items-center border-2 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-text",
                        accent === k
                          ? "border-text"
                          : "border-transparent hover:border-line-strong",
                      )}
                    >
                      <input
                        type="radio"
                        name="accent"
                        value={k}
                        checked={accent === k}
                        onChange={() => setAccent(k)}
                        className="sr-only"
                        aria-label={ACCENTS[k].label}
                      />
                      <span
                        aria-hidden
                        className="size-7"
                        style={{ backgroundColor: ACCENTS[k].color }}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor={headlineId} className={cn(SECTION, "mb-1 block text-[0.7rem]")}>
                  Headline
                </label>
                <input
                  id={headlineId}
                  value={headline}
                  maxLength={28}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Vandal main"
                  className="min-h-11 w-full border border-line-strong bg-bg/70 px-3 placeholder:text-faint"
                />
              </div>
              <div className="space-y-1">
                <Switch checked={showPrices} onChange={setShowPrices} label="Show skin prices" />
                <Switch checked={tilt} onChange={setTilt} label="Tilt the skin art" />
                {(template === "locker" || template === "collection") && (
                  <Switch
                    checked={showTierBar}
                    onChange={setShowTierBar}
                    label="Show the tier summary"
                  />
                )}
              </div>
            </section>

            <section aria-labelledby="opt-privacy" className="space-y-3 border-t border-line pt-5">
              <h2 id="opt-privacy" className={SECTION}>
                Privacy
              </h2>
              <Switch
                checked={showRiotId}
                onChange={(v) => setSettings({ showRiotIdOnShare: v })}
                label="Show my Riot ID and title"
                description="Off by default. Your account ID and token are never on the image."
              />
            </section>
          </Panel>
        </div>

        <SkinPicker
          open={picking}
          onClose={() => setPicking(false)}
          skins={showable}
          picked={picked}
          setPicked={setPicked}
          limit={slots || 15}
        />
        {compact &&
          // Rendered on <body>: the page transition wrapper would break position: fixed.
          createPortal(
            // Phones and tablets: downloads stay one tap away, just above the tab bar.
            <div className="fixed inset-x-0 bottom-[var(--tabbar)] z-30 border-t border-line bg-bg/95 px-4 py-3 [&>div]:flex-nowrap [&_button]:flex-1">
              {downloadActions}
            </div>,
            document.body,
          )}
      </div>
    </>
  );
}

const SECTION = "font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted";

type ShareMode = "image" | "link";

/** Image card or link: two different jobs, so two layouts. */
function ModeSwitch({ mode, setMode }: { mode: ShareMode; setMode: (m: ShareMode) => void }) {
  return (
    <div className="mb-6">
      <Tabs<ShareMode>
        label="Share as"
        value={mode}
        onChange={setMode}
        tabs={[
          { id: "image", label: "Image card" },
          { id: "link", label: "Share link" },
        ]}
      />
    </div>
  );
}

/** A row of mutually exclusive buttons (native radios underneath). */
function Segmented<T extends string>({
  legend,
  value,
  onChange,
  options,
}: {
  legend: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint?: string }[];
}) {
  return (
    <fieldset>
      <legend className={cn(SECTION, "mb-2 text-[0.7rem]")}>{legend}</legend>
      <div className="grid grid-flow-col gap-px border border-line-strong bg-line-strong">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex min-h-11 cursor-pointer flex-col items-center justify-center px-2 py-1.5 text-center transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-text",
              value === o.value ? "bg-accent text-accent-ink" : "bg-surface hover:bg-raised",
            )}
          >
            <input
              type="radio"
              name={legend}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            <span className="font-display text-sm font-bold uppercase">{o.label}</span>
            {o.hint && (
              <span
                className={cn(
                  "text-[0.65rem] tabular-nums",
                  value === o.value ? "text-accent-ink/80" : "text-muted",
                )}
              >
                {o.hint}
              </span>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function ShareRoute() {
  return (
    <RequireSession title="Share card">
      <PageHeader title="Share card">
        Turn your collection into an image card to post, or a link anyone can open.
      </PageHeader>
      <Share />
    </RequireSession>
  );
}
