import { describe, expect, it } from "vitest";
import pricing from "../../../docs/valorant_vp_pricing.json";
import {
  buildRegions,
  calculateCollectionValue,
  calculateTotalSpent,
  cheapestPacks,
  regionRate,
  regionValue,
  type RegionPricing,
} from "./regional-pricing";

const regions = buildRegions(pricing);
const get = (name: string) => regions.find((r) => r.region === name)!;

describe("buildRegions", () => {
  it("reads every region in the price list, packs smallest first", () => {
    expect(regions.map((r) => r.currency).sort()).toEqual([
      "AUD",
      "BRL",
      "CAD",
      "EUR",
      "GBP",
      "INR",
      "MXN",
      "MYR",
      "NZD",
      "PHP",
      "RUB",
      "TRY",
      "USD",
    ]);
    const ph = get("Philippines");
    expect(ph.packs).toEqual([
      { vp: 475, price: 199 },
      { vp: 1000, price: 399 },
      { vp: 2050, price: 799 },
      { vp: 3650, price: 1399 },
      { vp: 5350, price: 1999 },
      { vp: 11000, price: 3999 },
    ]);
    expect(ph.decimals).toBe(0);
    expect(get("USA").decimals).toBe(2);
  });

  it("skips broken rows and keeps one currency per region", () => {
    const rows = [
      { region: "A", currency: "AAA", vp_amount: 100, local_price: 1 },
      { region: "A", currency: "BBB", vp_amount: 200, local_price: 2 },
      { region: "", currency: "AAA", vp_amount: 100, local_price: 1 },
      { region: "B", currency: "bad", vp_amount: 100, local_price: 1 },
      { region: "C", currency: "CCC", vp_amount: 0, local_price: 1 },
      { region: "D", currency: "DDD", vp_amount: 100, local_price: -1 },
      { region: 5 as unknown as string, currency: "EEE", vp_amount: 1, local_price: 1 },
    ];
    expect(buildRegions(rows)).toEqual([
      { region: "A", currency: "AAA", packs: [{ vp: 100, price: 1 }], decimals: 0 },
    ]);
  });
});

describe("regional value", () => {
  it("values VP between the best and worst pack rates", () => {
    const ph = get("Philippines");
    expect(regionRate(ph).best).toBeCloseTo(3999 / 11000);
    expect(regionValue(ph, 1775)).toEqual({ low: 645, high: 744 });
    // Cents for currencies priced in cents.
    expect(regionValue(get("USA"), 1775)).toEqual({ low: 16.13, high: 18.65 });
    expect(regionValue(ph, 0)).toEqual({ low: 0, high: 0 });
    expect(regionValue(ph, Number.NaN)).toEqual({ low: 0, high: 0 });
  });

  it("sums a collection, ignoring bad amounts", () => {
    const ph = get("Philippines");
    expect(calculateCollectionValue([{ vp: 1775 }, { vp: 0 }, { vp: Number.NaN }], ph)).toEqual(
      regionValue(ph, 1775),
    );
  });
});

describe("cheapestPacks", () => {
  it("buys exactly when a pack matches", () => {
    expect(cheapestPacks(get("Philippines"), 11000)).toEqual({
      packs: [{ vp: 11000, price: 3999, count: 1 }],
      vp: 11000,
      price: 3999,
    });
  });

  it("combines packs and can overshoot when that's cheaper", () => {
    // 4 × 475 VP (₱796) beats 2,050 VP (₱799) and 1,000 + 2 × 475 (₱797).
    expect(cheapestPacks(get("Philippines"), 1775)).toEqual({
      packs: [{ vp: 475, price: 199, count: 4 }],
      vp: 1900,
      price: 796,
    });
    expect(cheapestPacks(get("Philippines"), 3000)).toMatchObject({ vp: 3000, price: 1197 }); // 2,050 + 2 × 475;
    const tiny: RegionPricing = {
      region: "T",
      currency: "TTT",
      decimals: 2,
      packs: [
        { vp: 2, price: 0.1 },
        { vp: 3, price: 0.1 },
      ],
    };
    expect(cheapestPacks(tiny, 1)).toEqual({
      packs: [{ vp: 2, price: 0.1, count: 1 }],
      vp: 2,
      price: 0.1,
    });
  });

  it("prices large totals in cents exactly", () => {
    const plan = calculateTotalSpent([{ vp: 22000 }, { vp: 475 }], get("USA"));
    expect(plan.price).toBe(204.97);
    expect(plan.vp).toBe(22475);
  });

  it("returns nothing for no VP or no packs", () => {
    expect(cheapestPacks(get("USA"), 0)).toEqual({ packs: [], vp: 0, price: 0 });
    expect(cheapestPacks({ ...get("USA"), packs: [] }, 100)).toEqual({
      packs: [],
      vp: 0,
      price: 0,
    });
  });
});
