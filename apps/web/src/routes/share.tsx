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
import { Dialog, Panel, Switch } from "@/components/ui/primitives";
import { useActiveSession } from "@/features/auth/session-store";
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
    const update = () => setScale(Math.min(1, el.clientWidth / dims.w, 680 / dims.h));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dims.w, dims.h]);

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
    currencyFormat: sp.currency.format,
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

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <Panel aria-label="Card options" className="h-fit space-y-6 lg:sticky lg:top-20">
        <fieldset>
          <legend className="mb-2 font-display text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            Template
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((t) => (
              <label
                key={t.id}
                className={cn(
                  "relative flex min-h-16 cursor-pointer flex-col justify-center border px-3 py-2 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-text",
                  template === t.id
                    ? "border-accent bg-accent/10"
                    : "border-line-strong hover:border-muted",
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
                  <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] bg-accent" />
                )}
                <span className="font-display text-lg font-bold uppercase leading-tight">
                  {t.label}
                </span>
                <span className="text-xs text-muted">{t.text}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Dropdown<SizeKey>
          label="Size"
          value={size}
          onChange={setSize}
          options={(Object.keys(SIZES) as SizeKey[]).map((k) => ({
            value: k,
            label: SIZES[k].label,
          }))}
        />

        <Dropdown<Background>
          label="Background"
          value={background}
          onChange={setBackground}
          options={[
            { value: "card", label: "My player card" },
            ...(bundleArt ? [{ value: "bundle" as const, label: "Featured bundle art" }] : []),
            { value: "none", label: "Grid only" },
          ]}
        />

        {template === "collection" && (
          <div className="space-y-3">
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
              Battle pass, contract and free skins are left out. Story size fits 20 skins per card.
            </p>
          </div>
        )}

        {slots > 0 && template !== "collection" && (
          <div className="space-y-2">
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
          </div>
        )}

        <fieldset className="space-y-3 border-t border-line pt-4">
          <legend className="sr-only">Style</legend>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            Style
          </p>
          <Dropdown<AccentKey>
            label="Accent color"
            value={accent}
            onChange={setAccent}
            options={(Object.keys(ACCENTS) as AccentKey[]).map((k) => ({
              value: k,
              label: ACCENTS[k].label,
            }))}
          />
          <div>
            <label
              htmlFor={headlineId}
              className="mb-1 block font-display text-xs font-semibold uppercase tracking-[0.08em] text-muted"
            >
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
          <Switch checked={showPrices} onChange={setShowPrices} label="Show skin prices" />
          <Switch checked={tilt} onChange={setTilt} label="Tilt the skin art" />
          {(template === "locker" || template === "collection") && (
            <Switch checked={showTierBar} onChange={setShowTierBar} label="Show the tier summary" />
          )}
        </fieldset>

        <Switch
          checked={showRiotId}
          onChange={(v) => setSettings({ showRiotIdOnShare: v })}
          label="Show my Riot ID and title"
          description="Off by default. Your account ID and token are never on the image."
        />

        <button
          type="button"
          className="btn-valo btn-valo-primary w-full"
          disabled={busy || !ready}
          onClick={() => void onExport()}
        >
          {busy && !batch ? "Creating PNG…" : !ready ? "Loading data…" : "Download PNG"}
        </button>
        {template === "collection" && pageCount > 1 && (
          <Button className="w-full" disabled={busy || !ready} onClick={() => void onExportAll()}>
            {batch
              ? `Saving card ${batch.done + 1} of ${batch.total}…`
              : `Download all ${pageCount} cards`}
          </Button>
        )}
      </Panel>

      <div ref={frameRef} className="min-w-0">
        <p className="mb-2 text-sm text-muted">
          Preview at {Math.round(scale * 100)}%. The download is {dims.w} × {dims.h} pixels.
        </p>
        <div
          className="relative overflow-hidden border border-line"
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
        <ShareLinkPanel
          skins={showable}
          allSkins={(sp.owned ?? []).map((o) => o.skin).filter((s) => !s.isDefault)}
          totalVp={sp.spending?.totalVp ?? null}
        />
      </div>

      <SkinPicker
        open={picking}
        onClose={() => setPicking(false)}
        skins={showable}
        picked={picked}
        setPicked={setPicked}
        limit={slots || 15}
      />
    </div>
  );
}

export default function ShareRoute() {
  return (
    <RequireSession title="Share card">
      <PageHeader title="Share card">
        Make a PNG of your locker, collection, spending, profile, rank or loadout, or share a link
        to your collection.
      </PageHeader>
      <Share />
    </RequireSession>
  );
}
