// Adds a v3 storefront (daily shop, featured bundles, Night Market) to the demo
// fixtures, using real skins and bundles from valorant-api.com. Runs after
// gen-fixtures.mjs and only appends: the demo account itself is unchanged.
// Usage: node scripts/gen-store-fixture.mjs
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "../apps/web/src/mocks/fixtures");
const API = "https://valorant-api.com";
const VP = "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741";
const SKIN_LEVEL = "e7c63390-eda7-46e0-bb7a-a6abdacd2433";
const GUN = { Select: 875, Deluxe: 1275, Premium: 1775, Exclusive: 2175, Ultra: 2475 };
const MELEE = { Select: 1750, Deluxe: 2550, Premium: 3550, Exclusive: 4350, Ultra: 4950 };

const get = async (path) => (await (await fetch(API + path)).json()).data;
const [weapons, bundles, themes, tiers, contracts, levelBorders] = await Promise.all([
  get("/v1/weapons"),
  get("/v1/bundles"),
  get("/v1/themes"),
  get("/v1/contenttiers"),
  get("/v1/contracts"),
  get("/v1/levelborders"),
]);
const riot = JSON.parse(await readFile(join(DIR, "riot.json"), "utf8"));
const staticData = JSON.parse(await readFile(join(DIR, "static.json"), "utf8"));

const tierName = Object.fromEntries(tiers.map((t) => [t.uuid, t.devName]));
const contractLevels = new Set(
  contracts.flatMap((c) =>
    (c.content.chapters ?? []).flatMap((ch) => ch.levels.map((l) => l.reward.uuid)),
  ),
);
const owned = new Set(riot.entitlements[SKIN_LEVEL]);
const all = weapons.flatMap((w) =>
  w.skins
    .filter((s) => s.uuid !== w.defaultSkinUuid && tierName[s.contentTierUuid])
    .filter((s) => !s.levels.some((l) => contractLevels.has(l.uuid)))
    .map((s) => ({ weapon: w, skin: s, tier: tierName[s.contentTierUuid] })),
);
const price = ({ weapon, tier }) => (weapon.displayName === "Melee" ? MELEE : GUN)[tier];
const notOwned = all
  .filter((x) => !owned.has(x.skin.levels[0].uuid))
  .sort((a, b) => a.skin.uuid.localeCompare(b.skin.uuid));

// Bundles whose name matches a skin theme with at least 4 skins in it.
const themeName = Object.fromEntries(themes.map((t) => [t.uuid, t.displayName]));
const byTheme = new Map();
for (const x of all) {
  const name = themeName[x.skin.themeUuid];
  if (name) byTheme.set(name, [...(byTheme.get(name) ?? []), x]);
}
const featured = bundles
  .filter((b) => (byTheme.get(b.displayName)?.length ?? 0) >= 4 && b.displayIcon)
  .sort((a, b) => a.displayName.localeCompare(b.displayName))
  .slice(0, 2);

const offer = (x, vp = price(x)) => ({
  OfferID: x.skin.levels[0].uuid,
  IsDirectPurchase: true,
  StartDate: "2026-10-01T00:00:00Z",
  Cost: { [VP]: vp },
  Rewards: [{ ItemTypeID: SKIN_LEVEL, ItemID: x.skin.levels[0].uuid, Quantity: 1 }],
});
const daily = [0, 37, 81, 133].map((i) => notOwned[i % notOwned.length]);
const night = [11, 29, 53, 97, 151, 199].map((i) => notOwned[i % notOwned.length]);
const discounts = [42, 18, 33, 25, 47, 21];

const bundleEntries = featured.map((b, bi) => {
  const items = byTheme.get(b.displayName).slice(0, 5);
  const base = items.reduce((s, x) => s + price(x), 0);
  return {
    bundle: b,
    items,
    raw: {
      ID: `demo-bundle-${bi + 1}`,
      DataAssetID: b.uuid,
      CurrencyID: VP,
      Items: items.map((x) => ({
        Item: { ItemTypeID: SKIN_LEVEL, ItemID: x.skin.levels[0].uuid, Amount: 1 },
        BasePrice: price(x),
        CurrencyID: VP,
        DiscountPercent: 0.2,
        DiscountedPrice: Math.round(price(x) * 0.8),
        IsPromoItem: false,
      })),
      TotalBaseCost: { [VP]: base },
      TotalDiscountedCost: { [VP]: Math.round(base * 0.8) },
      TotalDiscountPercent: 0.2,
      DurationRemainingInSeconds: [4, 11][bi] * 86_400 + 5_400,
      WholesaleOnly: false,
    },
  };
});

riot.storefront = {
  FeaturedBundle: {
    Bundle: bundleEntries[0]?.raw ?? null,
    Bundles: bundleEntries.map((e) => e.raw),
    BundleRemainingDurationInSeconds: bundleEntries[0]?.raw.DurationRemainingInSeconds ?? 0,
  },
  SkinsPanelLayout: {
    SingleItemOffers: daily.map((x) => x.skin.levels[0].uuid),
    SingleItemStoreOffers: daily.map((x) => offer(x)),
    SingleItemOffersRemainingDurationInSeconds: 9 * 3600 + 1234,
  },
  BonusStore: {
    BonusStoreOffers: night.map((x, i) => ({
      BonusOfferID: `demo-night-${i}`,
      Offer: offer(x),
      DiscountPercent: discounts[i],
      DiscountCosts: { [VP]: Math.round(price(x) * (1 - discounts[i] / 100)) },
      IsSeen: i < 3,
    })),
    BonusStoreRemainingDurationInSeconds: 6 * 86_400 + 3_600,
  },
};

// Make sure every skin in the store exists in the trimmed weapons fixture.
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k] ?? null]));
const storeSkins = [...daily, ...night, ...bundleEntries.flatMap((e) => e.items)];
for (const x of storeSkins) {
  const w = staticData.weapons.find((w) => w.uuid === x.weapon.uuid);
  if (w.skins.some((s) => s.uuid === x.skin.uuid)) continue;
  w.skins.push({
    ...pick(x.skin, [
      "uuid",
      "displayName",
      "themeUuid",
      "contentTierUuid",
      "displayIcon",
      "wallpaper",
    ]),
    chromas: x.skin.chromas.map((c) =>
      pick(c, ["uuid", "displayName", "displayIcon", "fullRender", "swatch", "streamedVideo"]),
    ),
    levels: x.skin.levels.map((l) =>
      pick(l, ["uuid", "displayName", "levelItem", "displayIcon", "streamedVideo"]),
    ),
  });
}
staticData.bundles = featured.map((b) =>
  pick(b, [
    "uuid",
    "displayName",
    "displayNameSubText",
    "displayIcon",
    "displayIcon2",
    "verticalPromoImage",
  ]),
);

// Level borders for the dashboard profile card (small, so all of them).
staticData.levelBorders = levelBorders.map((b) =>
  pick(b, ["uuid", "startingLevel", "levelNumberAppearance", "smallPlayerCardAppearance"]),
);

await writeFile(join(DIR, "riot.json"), JSON.stringify(riot));
await writeFile(join(DIR, "static.json"), JSON.stringify(staticData));
console.log(
  `Storefront: ${daily.length} daily, ${bundleEntries.length} bundles (${featured.map((b) => b.displayName).join(", ")}), ${night.length} Night Market`,
);
