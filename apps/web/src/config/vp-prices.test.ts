import { formatMoney, formatMoneyRange, vpToMoneyRange } from "@valovertix/calc";
import { VP_PACKS_PHP, VP_PRICES, vpRate } from "./vp-prices";

const rate = vpRate(VP_PACKS_PHP);
const php = { locale: VP_PRICES.PHP.locale, currency: "PHP" };

describe("PH VP pack table", () => {
  it("derives the best and smallest-pack rates", () => {
    expect(rate.best).toBeCloseTo(3999 / 11000);
    expect(rate.smallest).toBeCloseTo(199 / 475);
  });

  it("converts 1,775 VP to ₱645–₱744", () => {
    expect(vpToMoneyRange(1775, rate)).toEqual({ low: 645, high: 744 });
    expect(formatMoneyRange(vpToMoneyRange(1775, rate), php)).toBe("₱645–₱744");
  });

  it("converts 0 VP to ₱0–₱0", () => {
    expect(vpToMoneyRange(0, rate)).toEqual({ low: 0, high: 0 });
  });

  it("formats with Intl.NumberFormat en-PH PHP", () => {
    const intl = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
    expect(formatMoney(645, php)).toBe(intl.format(645));
    expect(formatMoney(744, php)).toBe(intl.format(744));
  });
});
