import { PRICING_REGIONS, detectRegion, getRegionalPricing, regionOptionLabel } from "./pricing";
import { makePricing } from "@/features/pricing";

describe("regional pricing config", () => {
  it("offers every region from the price list, Philippines first", () => {
    expect(PRICING_REGIONS.map(regionOptionLabel)).toEqual([
      "Philippines (PHP)",
      "USA (USD)",
      "Europe (EUR)",
      "UK (GBP)",
      "Canada (CAD)",
      "Australia (AUD)",
      "Brazil (BRL)",
      "Mexico (MXN)",
      "Turkey (TRY)",
      "India (INR)",
      "Malaysia (MYR)",
      "New Zealand (NZD)",
      "Russia (RUB)",
    ]);
  });

  it("guesses the region from browser languages", () => {
    expect(detectRegion(["en-PH"])).toBe("PHP");
    expect(detectRegion(["en", "de-DE"])).toBe("EUR");
    expect(detectRegion(["en-gb"])).toBe("GBP");
    expect(detectRegion(["ja-JP", "pt-BR"])).toBe("BRL");
    expect(detectRegion(["en"])).toBe("PHP");
    expect(detectRegion([])).toBe("PHP");
  });

  it("falls back for unknown or missing regions", () => {
    expect(getRegionalPricing("XYZ").id).toBe("PHP");
    expect(getRegionalPricing(null).id).toBe("PHP");
    expect(getRegionalPricing("USD").label).toBe("USA");
  });

  it("formats each region in its own currency, cents only where prices have them", () => {
    const usa = makePricing(getRegionalPricing("USD"), false);
    expect(usa.fmtValue(1775)).toBe("$16.13–$18.65");
    expect(usa.fmtAmount(usa.spent(1775).price)).toBe("$19.96"); // 4 × 475 VP
    expect(usa.label).toBe("USA pricing");
    const ph = makePricing(getRegionalPricing("PHP"), true);
    expect(ph.fmtValue(1775)).toBe("₱645–₱744");
    expect(ph.auto).toBe(true);
    const uk = makePricing(getRegionalPricing("GBP"), false);
    expect(uk.fmtAmount(4.5)).toBe("£4.50");
  });
});
