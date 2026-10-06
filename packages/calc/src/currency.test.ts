import { describe, expect, it } from "vitest";
import { formatMoney, formatMoneyRange, formatVp, vpToMoneyRange, type VpRate } from "./currency";

// Mirrors apps/web/src/config/vp-prices.ts (largest and smallest PH packs).
const PHP_RATE: VpRate = { best: 3999 / 11000, smallest: 199 / 475 };
const PHP = { locale: "en-PH", currency: "PHP" };

describe("vpToMoneyRange", () => {
  it("converts 1,775 VP to ₱645–₱744", () => {
    expect(vpToMoneyRange(1775, PHP_RATE)).toEqual({ low: 645, high: 744 });
  });

  it("converts 0 VP to ₱0–₱0", () => {
    expect(vpToMoneyRange(0, PHP_RATE)).toEqual({ low: 0, high: 0 });
  });

  it("treats negative and non-finite input as zero", () => {
    expect(vpToMoneyRange(-5, PHP_RATE)).toEqual({ low: 0, high: 0 });
    expect(vpToMoneyRange(Number.NaN, PHP_RATE)).toEqual({ low: 0, high: 0 });
  });
});

describe("formatMoney", () => {
  it("matches Intl.NumberFormat en-PH PHP output", () => {
    const intl = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
    expect(formatMoney(645, PHP)).toBe(intl.format(645));
    expect(formatMoney(12345.5, PHP)).toBe(intl.format(12345.5));
    expect(formatMoney(645, PHP)).toBe("₱645.00");
  });

  it("can drop centavos", () => {
    expect(formatMoney(1234, PHP, { wholeUnits: true })).toBe("₱1,234");
  });

  it("formats ranges", () => {
    expect(formatMoneyRange({ low: 645, high: 744 }, PHP)).toBe("₱645–₱744");
    expect(formatMoneyRange({ low: 0, high: 0 }, PHP)).toBe("₱0");
    expect(formatMoneyRange({ low: 1, high: 2 }, PHP, {})).toBe("₱1.00–₱2.00");
  });

  it("formats VP", () => {
    expect(formatVp(11000)).toBe("11,000 VP");
  });
});
