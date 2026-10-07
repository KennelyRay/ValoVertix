import { describe, expect, it } from "vitest";
import {
  countBy,
  groupByCollection,
  indexOffers,
  resolveOwnedSkins,
  upgradeCount,
} from "./collection";
import {
  AGENT_UNLOCK_VP,
  computeSpending,
  pricedRatio,
  radianiteForSkin,
  radianiteToMax,
  skinPriceVp,
} from "./spending";
import type { SkinRef } from "./types";

const VP = "vp";
const RAD = "rad";
const currency = { vp: VP, radianite: RAD };

function skin(id: string, over: Partial<SkinRef> = {}): SkinRef {
  return {
    uuid: id,
    name: `Skin ${id}`,
    weaponId: "vandal",
    tierId: "premium",
    themeId: "theme-a",
    levels: [{ uuid: `${id}-l1` }, { uuid: `${id}-l2` }, { uuid: `${id}-l3` }],
    chromas: [{ uuid: `${id}-c0` }, { uuid: `${id}-c1` }, { uuid: `${id}-c2` }],
    isDefault: false,
    isContractReward: false,
    ...over,
  };
}

const offer = (itemId: string, cost: Record<string, number>) => ({
  Cost: cost,
  Rewards: [{ ItemID: itemId }],
});

describe("indexOffers", () => {
  it("keys single-reward offers by lowercase item ID", () => {
    const index = indexOffers([
      offer("ABC", { [VP]: 875 }),
      { Cost: { [VP]: 9000 }, Rewards: [{ ItemID: "x" }, { ItemID: "y" }] },
      { Cost: { [VP]: 1 }, Rewards: [] },
    ]);
    expect(index.get("abc")).toEqual({ [VP]: 875 });
    expect(index.has("x")).toBe(false);
    expect(index.size).toBe(1);
  });
});

describe("resolveOwnedSkins", () => {
  const skins = [
    skin("a"),
    skin("b"),
    skin("std", { isDefault: true, levels: [{ uuid: "std-l1" }], chromas: [] }),
  ];

  it("groups owned levels and non-base chromas per skin, case-insensitively", () => {
    const owned = resolveOwnedSkins(skins, ["A-L1", "a-l2", "std-l1"], ["a-c0", "a-c2"]);
    expect(owned).toHaveLength(1);
    expect(owned[0]?.levelIds).toEqual(["a-l1", "a-l2"]);
    expect(owned[0]?.chromaIds).toEqual(["a-c2"]);
    expect(upgradeCount(owned[0]!)).toBe(2);
  });

  it("skips skins with no owned levels and default skins", () => {
    expect(resolveOwnedSkins(skins, ["std-l1"], [])).toEqual([]);
  });

  it("counts by key with an unknown bucket", () => {
    const counts = countBy([skin("a"), skin("b", { tierId: null })], (s) => s.tierId);
    expect(Object.fromEntries(counts)).toEqual({ premium: 1, unknown: 1 });
  });
});

describe("computeSpending", () => {
  const skins = [
    skin("a", { tierId: "premium", weaponId: "vandal", themeId: "t1" }),
    skin("b", { tierId: "select", weaponId: "phantom", themeId: "t1" }),
    skin("bp", { isContractReward: true }),
    skin("ex", { tierId: "exclusive" }),
  ];
  const offers = indexOffers([
    offer("a-l1", { [VP]: 1775 }),
    offer("a-l2", { [RAD]: 10 }),
    offer("a-l3", { [RAD]: 15 }),
    offer("a-c1", { [RAD]: 15 }),
    offer("b-l1", { [VP]: 875 }),
    offer("ex-l1", { [VP]: 0 }),
    offer("bp-l2", { [RAD]: 0 }),
  ]);
  const owned = resolveOwnedSkins(
    skins,
    ["a-l1", "a-l2", "a-l3", "b-l1", "bp-l1", "bp-l2", "ex-l1"],
    ["a-c1", "a-c2"],
  );

  it("splits priced and unpriced skins and totals VP", () => {
    const r = computeSpending({ ownedSkins: owned, offers, currency });
    expect(r.priced.map((p) => [p.owned.skin.uuid, p.vp])).toEqual([
      ["a", 1775],
      ["b", 875],
    ]);
    expect(r.unpriced.map((u) => [u.owned.skin.uuid, u.reason])).toEqual([
      ["bp", "contract"],
      ["ex", "no_offer"],
    ]);
    expect(r.skinVp).toBe(2650);
    expect(r.totalVp).toBe(2650);
    expect(pricedRatio(r)).toBe(0.5);
  });

  it("sums Radianite for owned upgrades that have offers", () => {
    const r = computeSpending({ ownedSkins: owned, offers, currency });
    // a-l2 (10) + a-l3 (15) + a-c1 (15); a-c2 has no offer, bp-l2 costs 0.
    expect(r.radianite).toBe(40);
    expect(r.radianiteItems).toBe(3);
    expect(radianiteForSkin(owned[0]!, offers, RAD)).toEqual({ total: 40, items: 3 });
  });

  it("breaks totals down by tier, weapon and theme", () => {
    const r = computeSpending({ ownedSkins: owned, offers, currency });
    expect(r.byTier).toEqual([
      { key: "premium", vp: 1775, count: 1 },
      { key: "select", vp: 875, count: 1 },
    ]);
    expect(r.byWeapon[0]).toEqual({ key: "vandal", vp: 1775, count: 1 });
    expect(r.byTheme).toEqual([{ key: "t1", vp: 2650, count: 2 }]);
  });

  it("puts null breakdown keys in an unknown bucket", () => {
    const s = skin("n", { themeId: null });
    const r = computeSpending({
      ownedSkins: resolveOwnedSkins([s], ["n-l1"], []),
      offers: indexOffers([offer("n-l1", { [VP]: 1275 })]),
      currency,
    });
    expect(r.byTheme).toEqual([{ key: "unknown", vp: 1275, count: 1 }]);
  });

  it("breaks VP ties in breakdowns by skin count", () => {
    const skins2 = [
      skin("p", { weaponId: "one" }),
      skin("q", { weaponId: "two" }),
      skin("r", { weaponId: "two" }),
    ];
    const r = computeSpending({
      ownedSkins: resolveOwnedSkins(skins2, ["p-l1", "q-l1", "r-l1"], []),
      offers: indexOffers([
        offer("p-l1", { [VP]: 1000 }),
        offer("q-l1", { [VP]: 500 }),
        offer("r-l1", { [VP]: 500 }),
      ]),
      currency,
    });
    expect(r.byWeapon.map((b) => [b.key, b.count])).toEqual([
      ["two", 2],
      ["one", 1],
    ]);
  });

  it("adds agents only when the toggle is on", () => {
    const off = computeSpending({ ownedSkins: owned, offers, currency, paidAgentIds: ["x", "y"] });
    expect(off.agentVp).toBe(0);
    const on = computeSpending({
      ownedSkins: owned,
      offers,
      currency,
      includeAgents: true,
      paidAgentIds: ["x", "y"],
    });
    expect(on.agentCount).toBe(2);
    expect(on.agentVp).toBe(2 * AGENT_UNLOCK_VP);
    expect(on.totalVp).toBe(2650 + 2000);
    expect(
      computeSpending({ ownedSkins: [], offers, currency, includeAgents: true }).agentCount,
    ).toBe(0);
  });

  it("prices skins without an offer from the fallback, but never contract rewards", () => {
    const r = computeSpending({
      ownedSkins: owned,
      offers,
      currency,
      fallbackVp: (s) => (s.tierId === "exclusive" ? 2175 : s.isContractReward ? 999 : undefined),
    });
    expect(r.priced.map((p) => [p.owned.skin.uuid, p.vp, p.source])).toEqual([
      ["ex", 2175, "tier"],
      ["a", 1775, "offer"],
      ["b", 875, "offer"],
    ]);
    expect(r.unpriced.map((u) => [u.owned.skin.uuid, u.reason])).toEqual([["bp", "contract"]]);
    expect(r.skinVp).toBe(2650 + 2175);
  });

  it("ignores zero or missing fallback prices", () => {
    const r = computeSpending({ ownedSkins: owned, offers, currency, fallbackVp: () => 0 });
    expect(r.priced).toHaveLength(2);
  });

  it("handles an empty inventory", () => {
    const r = computeSpending({ ownedSkins: [], offers, currency });
    expect(r.totalVp).toBe(0);
    expect(pricedRatio(r)).toBe(0);
  });

  it("sorts equal prices by name and handles skins with no levels", () => {
    const x = skin("x", { name: "Beta" });
    const y = skin("y", { name: "Alpha" });
    const z = { ...skin("z"), levels: [] };
    const r = computeSpending({
      ownedSkins: [
        { skin: x, levelIds: ["x-l1"], chromaIds: [] },
        { skin: y, levelIds: ["y-l1"], chromaIds: [] },
        { skin: z, levelIds: [], chromaIds: [] },
      ],
      offers: indexOffers([offer("x-l1", { [VP]: 875 }), offer("y-l1", { [VP]: 875 })]),
      currency,
    });
    expect(r.priced.map((p) => p.owned.skin.name)).toEqual(["Alpha", "Beta"]);
    expect(r.unpriced).toHaveLength(1);
  });
});

describe("groupByCollection", () => {
  it("groups owned skins with every skin in their collection", () => {
    const all = [
      skin("a1", { themeId: "reaver" }),
      skin("a2", { themeId: "reaver" }),
      skin("a3", { themeId: "reaver" }),
      skin("b1", { themeId: "prime" }),
      skin("d", { themeId: "reaver", isDefault: true }),
      skin("n", { themeId: null }),
    ];
    const owned = resolveOwnedSkins(all, ["a1-l1", "a3-l1", "n-l1"], []);
    const groups = groupByCollection(all, owned);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.themeId).toBe("reaver");
    expect(groups[0]!.skins.map((s) => s.uuid)).toEqual(["a1", "a2", "a3"]);
    expect(groups[0]!.owned.map((o) => o.skin.uuid)).toEqual(["a1", "a3"]);
  });
});

describe("radianiteToMax and skinPriceVp", () => {
  const s = skin("a");
  const offers = indexOffers([
    offer("a-l1", { [VP]: 1775 }),
    offer("A-L2", { [RAD]: 10 }),
    offer("a-l3", { [RAD]: 15 }),
    offer("a-c1", { [RAD]: 15 }),
    offer("a-c2", { [RAD]: 0 }),
  ]);

  it("prices only the levels and chromas not owned yet", () => {
    expect(
      radianiteToMax({ skin: s, levelIds: ["a-l1", "A-L2"], chromaIds: [] }, offers, RAD),
    ).toEqual({
      total: 30,
      items: 2,
    });
    const maxed = { skin: s, levelIds: ["a-l1", "a-l2", "a-l3"], chromaIds: ["a-c1", "a-c2"] };
    expect(radianiteToMax(maxed, offers, RAD)).toEqual({ total: 0, items: 0 });
  });

  it("uses the store price, then the fallback, never for contract rewards", () => {
    expect(skinPriceVp(s, offers, VP)).toBe(1775);
    expect(skinPriceVp(skin("b"), offers, VP, () => 875)).toBe(875);
    expect(skinPriceVp(skin("b"), offers, VP, () => 0)).toBeUndefined();
    expect(skinPriceVp(skin("b"), offers, VP)).toBeUndefined();
    expect(
      skinPriceVp(skin("c", { isContractReward: true }), offers, VP, () => 875),
    ).toBeUndefined();
    expect(skinPriceVp(skin("d", { levels: [] }), offers, VP)).toBeUndefined();
  });
});
