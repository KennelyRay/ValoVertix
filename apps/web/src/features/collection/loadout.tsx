import { useMemo } from "react";
import type { CatalogSkin, Weapon } from "@valovertix/assets";
import { LoadingBlock } from "@/components/shared";
import { EmptyNote, ErrorNote } from "@/components/ui/primitives";
import { useLoadout, useSkinCatalog, useStatic } from "@/features/data";
import { cn } from "@/lib/cn";
import { apiColor } from "@/lib/format";

export interface EquippedGun {
  weapon: Weapon;
  skin: CatalogSkin | undefined;
  /** The equipped variant's render, else the skin's, else the plain weapon. */
  image: string | null;
  /** The standard skin is equipped. */
  isDefault: boolean;
}

/** In-game order: sidearms, SMGs, shotguns, rifles, snipers, heavies, melee. */
const CATEGORY_ORDER = ["Sidearm", "SMG", "Shotgun", "Rifle", "Sniper", "Heavy", "Melee"];
const categoryOf = (w: Weapon) => w.category.replace("EEquippableCategory::", "");

/** The equipped skin for every weapon, in in-game order. */
export function useEquippedGuns() {
  const loadout = useLoadout();
  const weapons = useStatic("weapons");
  const { catalog, tierById } = useSkinCatalog();

  const guns = useMemo<EquippedGun[] | null>(() => {
    if (!loadout.data || !weapons.data || !catalog) return null;
    const byWeapon = new Map(loadout.data.Guns.map((g) => [g.ID.toLowerCase(), g]));
    return weapons.data
      .filter((w) => byWeapon.has(w.uuid.toLowerCase()))
      .sort(
        (a, b) =>
          CATEGORY_ORDER.indexOf(categoryOf(a)) - CATEGORY_ORDER.indexOf(categoryOf(b)) ||
          a.displayName.localeCompare(b.displayName),
      )
      .map((weapon) => {
        const g = byWeapon.get(weapon.uuid.toLowerCase())!;
        const skin = catalog.byId.get(g.SkinID.toLowerCase());
        const chroma = skin?.chromas.find(
          (c) => c.uuid.toLowerCase() === g.ChromaID?.toLowerCase(),
        );
        const isDefault = !skin || skin.isDefault;
        return {
          weapon,
          skin,
          image: isDefault
            ? weapon.displayIcon
            : (chroma?.fullRender ?? chroma?.icon ?? skin?.icon ?? weapon.displayIcon),
          isDefault,
        };
      });
  }, [loadout.data, weapons.data, catalog]);

  return {
    guns,
    tierById,
    isPending: loadout.isPending || weapons.isPending || !catalog,
    isError: loadout.isError || weapons.isError,
  };
}

const PLURAL: Record<string, string> = {
  Sidearm: "Sidearms",
  SMG: "SMGs",
  Shotgun: "Shotguns",
  Rifle: "Rifles",
  Sniper: "Snipers",
  Heavy: "Heavies",
  Melee: "Melee",
};

/** Columns like the client's Collection screen. */
const COLUMNS = [["Sidearm"], ["SMG", "Shotgun"], ["Rifle", "Melee"], ["Sniper", "Heavy"]];

export function LoadoutView() {
  const { guns, tierById, isPending, isError } = useEquippedGuns();
  if (isError) {
    return (
      <ErrorNote title="Couldn't load your loadout.">
        Riot didn't return your equipped skins. Your collection still works.
      </ErrorNote>
    );
  }
  if (isPending || !guns) return <LoadingBlock label="Loading your loadout" />;
  if (guns.length === 0) {
    return (
      <EmptyNote title="No loadout to show">
        Riot didn't include your equipped weapons. Try again later.
      </EmptyNote>
    );
  }
  const custom = guns.filter((g) => !g.isDefault).length;

  return (
    <div>
      <p className="text-sm text-muted">
        What you have equipped right now: {custom} of {guns.length} weapons with a skin.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((cats) => (
          <div key={cats.join()} className="space-y-4">
            {cats.map((cat) => {
              const items = guns.filter((g) => categoryOf(g.weapon) === cat);
              if (!items.length) return null;
              return (
                <section key={cat} aria-label={PLURAL[cat]}>
                  <h3 className="mb-2 font-display text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    {PLURAL[cat]}
                  </h3>
                  <ul className="space-y-2">
                    {items.map((g) => {
                      const tier = g.skin?.tierId ? tierById.get(g.skin.tierId) : undefined;
                      return (
                        <li
                          key={g.weapon.uuid}
                          className={cn(
                            "panel relative overflow-hidden p-3",
                            g.isDefault && "opacity-70",
                          )}
                        >
                          {tier && (
                            <span
                              aria-hidden
                              className="absolute inset-y-0 left-0 w-0.5"
                              style={{ backgroundColor: apiColor(tier.highlightColor) }}
                            />
                          )}
                          <p className="text-xs uppercase tracking-wider text-muted">
                            {g.weapon.displayName}
                          </p>
                          <div className="flex h-16 items-center justify-center">
                            {g.image && (
                              <img
                                src={g.image}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="max-h-14 max-w-[90%] object-contain"
                              />
                            )}
                          </div>
                          <p className="truncate text-sm font-medium">
                            {g.isDefault ? "Standard" : (g.skin?.name ?? "Unknown skin")}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
