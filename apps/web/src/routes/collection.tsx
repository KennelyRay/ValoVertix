import { useDeferredValue, useId, useMemo, useState, type ReactNode } from "react";
import type { CatalogSkin } from "@valovertix/assets";
import { upgradeCount, type OwnedSkin } from "@valovertix/calc";
import { LoadingBlock, PageHeader, RequireSession } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { EmptyNote, ErrorNote, Switch, Tabs } from "@/components/ui/primitives";
import { SkinDrawer } from "@/features/collection/skin-drawer";
import { SkinGrid } from "@/features/collection/skin-grid";
import { useCollectibles, useSpending } from "@/features/data";
import { useSettings } from "@/features/settings-store";
import { fmtInt } from "@/lib/format";

type Tab = "skins" | "buddies" | "cards" | "sprays" | "titles" | "agents";
type PriceFilter = "any" | "lt1000" | "1000to1999" | "gte2000" | "unpriced";
type UpgradeFilter = "any" | "some" | "none";

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-sm text-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full border border-line-strong bg-raised px-2"
      >
        {children}
      </select>
    </div>
  );
}

function Skins() {
  const { owned, catalog, tierById, themeById, tiers, offerIndex, spending, isPending, error } =
    useSpending();
  // Same prices as the spending estimate: store offers, or tier prices when Riot's list is unavailable.
  const priceBySkin = useMemo(
    () => new Map(spending?.priced.map((p) => [p.owned.skin.uuid, p]) ?? []),
    [spending],
  );
  const hideFree = useSettings((s) => s.hideFreeSkins);
  const setSettings = useSettings((s) => s.set);
  const [query, setQuery] = useState("");
  const [weapon, setWeapon] = useState("all");
  const [tier, setTier] = useState("all");
  const [theme, setTheme] = useState("all");
  const [upgrades, setUpgrades] = useState<UpgradeFilter>("any");
  const [price, setPrice] = useState<PriceFilter>("any");
  const [open, setOpen] = useState<OwnedSkin<CatalogSkin> | null>(null);
  const q = useDeferredValue(query.trim().toLowerCase());
  const searchId = useId();

  const priceOf = (o: OwnedSkin) => priceBySkin.get(o.skin.uuid)?.vp;

  const filtered = useMemo(() => {
    if (!owned) return [];
    return owned.filter((o) => {
      const s = o.skin;
      if (hideFree && (s.isContractReward || s.tierId === null)) return false;
      if (q && !s.name.toLowerCase().includes(q)) return false;
      if (weapon !== "all" && s.weaponId !== weapon) return false;
      if (tier !== "all" && s.tierId !== tier) return false;
      if (theme !== "all" && s.themeId !== theme) return false;
      if (upgrades === "some" && upgradeCount(o) === 0) return false;
      if (upgrades === "none" && upgradeCount(o) > 0) return false;
      if (price !== "any") {
        const vp = priceOf(o);
        if (price === "unpriced") return vp === undefined;
        if (vp === undefined) return false;
        if (price === "lt1000" && vp >= 1000) return false;
        if (price === "1000to1999" && (vp < 1000 || vp >= 2000)) return false;
        if (price === "gte2000" && vp < 2000) return false;
      }
      return true;
    });
    // priceOf only depends on priceBySkin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owned, hideFree, q, weapon, tier, theme, upgrades, price, priceBySkin]);

  const groups = useMemo(() => {
    if (!catalog) return [];
    return catalog.weapons
      .map((w) => ({
        weapon: w.name,
        skins: filtered
          .filter((o) => o.skin.weaponId === w.uuid)
          .sort((a, b) => a.skin.name.localeCompare(b.skin.name)),
      }))
      .filter((g) => g.skins.length > 0);
  }, [catalog, filtered]);

  const ownedThemes = useMemo(() => {
    const ids = new Set(owned?.map((o) => o.skin.themeId).filter(Boolean));
    return [...ids]
      .map((id) => themeById.get(id!))
      .filter((t) => t !== undefined)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [owned, themeById]);

  if (isPending) return <LoadingBlock label="Loading your skins" />;
  if (error || !owned || !catalog) {
    return (
      <ErrorNote title="Couldn't load your skins.">
        Riot or the game-data service didn't respond. Try reloading the page.
      </ErrorNote>
    );
  }

  const reset = () => {
    setQuery("");
    setWeapon("all");
    setTier("all");
    setTheme("all");
    setUpgrades("any");
    setPrice("any");
  };
  const hiddenFree = hideFree
    ? owned.filter((o) => o.skin.isContractReward || o.skin.tierId === null).length
    : 0;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="col-span-2 lg:col-span-5">
          <label htmlFor={searchId} className="mb-1 block text-sm text-muted">
            Search by name
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Skin name, e.g. Reaver"
            className="min-h-11 w-full border border-line-strong bg-raised px-3 placeholder:text-faint"
          />
        </div>
        <Select label="Weapon" value={weapon} onChange={setWeapon}>
          <option value="all">All weapons</option>
          {catalog.weapons.map((w) => (
            <option key={w.uuid} value={w.uuid}>
              {w.name}
            </option>
          ))}
        </Select>
        <Select label="Tier" value={tier} onChange={setTier}>
          <option value="all">All tiers</option>
          {[...tiers]
            .sort((a, b) => a.rank - b.rank)
            .map((t) => (
              <option key={t.uuid} value={t.uuid.toLowerCase()}>
                {t.displayName.replace(/ Edition$/, "")}
              </option>
            ))}
        </Select>
        <Select label="Collection" value={theme} onChange={setTheme}>
          <option value="all">All collections</option>
          {ownedThemes.map((t) => (
            <option key={t.uuid} value={t.uuid.toLowerCase()}>
              {t.displayName}
            </option>
          ))}
        </Select>
        <Select label="Upgrades" value={upgrades} onChange={(v) => setUpgrades(v as UpgradeFilter)}>
          <option value="any">Any</option>
          <option value="some">Has owned upgrades</option>
          <option value="none">Base only</option>
        </Select>
        <Select label="Price" value={price} onChange={(v) => setPrice(v as PriceFilter)}>
          <option value="any">Any price</option>
          <option value="lt1000">Under 1,000 VP</option>
          <option value="1000to1999">1,000 to 1,999 VP</option>
          <option value="gte2000">2,000 VP and up</option>
          <option value="unpriced">No store price</option>
        </Select>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 border-b border-line pb-3">
        <p className="text-sm text-muted" aria-live="polite">
          Showing {fmtInt(filtered.length)} of {fmtInt(owned.length)} skins
          {hiddenFree > 0 && `, ${hiddenFree} free skins hidden`}
        </p>
        <div className="w-full sm:w-auto">
          <Switch
            checked={hideFree}
            onChange={(v) => setSettings({ hideFreeSkins: v })}
            label="Hide free skins"
            description="Battle pass, contract and other no-tier rewards"
          />
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="mt-6">
          <EmptyNote title="No skins match these filters">
            <Button size="sm" className="mt-3" onClick={reset}>
              Clear filters
            </Button>
          </EmptyNote>
        </div>
      ) : (
        <SkinGrid groups={groups} tierById={tierById} onOpen={setOpen} />
      )}

      <SkinDrawer
        owned={open}
        offers={offerIndex}
        price={open ? priceBySkin.get(open.skin.uuid) : undefined}
        tierName={
          open?.skin.tierId
            ? tierById.get(open.skin.tierId)?.displayName.replace(/ Edition$/, "")
            : undefined
        }
        onClose={() => setOpen(null)}
      />
    </div>
  );
}

function ItemGrid<T extends { uuid: string; displayName: string }>({
  items,
  image,
  wide = false,
  render,
}: {
  items: T[] | null;
  image?: (item: T) => string | null;
  wide?: boolean;
  render?: (item: T) => ReactNode;
}) {
  if (!items) return <LoadingBlock label="Loading" />;
  if (items.length === 0) return <EmptyNote title="Nothing here yet" />;
  return (
    <ul
      className={
        wide
          ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          : "grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6"
      }
    >
      {items.map((item) => {
        const src = image?.(item);
        return (
          <li key={item.uuid} className="panel flex flex-col items-center gap-2 p-3 text-center">
            {src && (
              <img
                src={src}
                alt={item.displayName}
                loading="lazy"
                decoding="async"
                className={wide ? "h-20 w-full object-cover" : "h-16 w-16 object-contain"}
              />
            )}
            {render ? render(item) : <span className="text-sm">{item.displayName}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function Collection() {
  const [tab, setTab] = useState<Tab>("skins");
  const { owned } = useSpending();
  const c = useCollectibles();
  const count = (n: number | undefined | null) => (n == null ? "" : ` ${n}`);
  const tabs: { id: Tab; label: ReactNode }[] = [
    { id: "skins", label: `Skins${count(owned?.length)}` },
    { id: "buddies", label: `Buddies${count(c.buddies?.length)}` },
    { id: "cards", label: `Cards${count(c.cards?.length)}` },
    { id: "sprays", label: `Sprays${count(c.sprays?.length)}` },
    { id: "titles", label: `Titles${count(c.titles?.length)}` },
    { id: "agents", label: `Agents${count(c.agents?.length)}` },
  ];
  return (
    <>
      <Tabs label="Collection type" value={tab} onChange={setTab} tabs={tabs} />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-5">
        {c.errors.length > 0 && tab !== "skins" && (
          <p className="mb-3 text-sm text-muted">
            Some of your items didn't load: {c.errors.join(", ")}.
          </p>
        )}
        {tab === "skins" && <Skins />}
        {tab === "buddies" && <ItemGrid items={c.buddies} image={(b) => b.displayIcon} />}
        {tab === "cards" && <ItemGrid wide items={c.cards} image={(x) => x.wideArt} />}
        {tab === "sprays" && (
          <ItemGrid items={c.sprays} image={(s) => s.fullTransparentIcon ?? s.displayIcon} />
        )}
        {tab === "titles" && (
          <ItemGrid
            items={c.titles}
            render={(t) => (
              <span className="font-display text-lg font-semibold">
                {t.titleText ?? t.displayName}
              </span>
            )}
          />
        )}
        {tab === "agents" && (
          <ItemGrid
            items={c.agents}
            image={(a) => a.displayIcon}
            render={(a) => (
              <span className="text-sm">
                {a.displayName}
                {a.isBaseContent && <span className="block text-xs text-muted">Starter</span>}
              </span>
            )}
          />
        )}
      </div>
    </>
  );
}

export default function CollectionRoute() {
  return (
    <RequireSession title="Collection">
      <PageHeader title="Collection">
        Everything on this account, grouped by weapon. Select a skin for levels, variants and price.
      </PageHeader>
      <Collection />
    </RequireSession>
  );
}
