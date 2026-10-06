import { apiColor, fmtCountdown, fmtTimeLeft, fmtPct, fmtVp, queueName, titleCase } from "./format";

describe("formatters", () => {
  it("formats the expiry countdown", () => {
    expect(fmtCountdown(0)).toBe("expired");
    expect(fmtCountdown(-5)).toBe("expired");
    expect(fmtCountdown(65_000)).toBe("01:05");
    expect(fmtCountdown(59 * 60_000 + 59_000)).toBe("59:59");
    expect(fmtCountdown(3_600_000 + 61_000)).toBe("1:01:01");
  });

  it("formats store time left", () => {
    expect(fmtTimeLeft(0)).toBe("refreshing");
    expect(fmtTimeLeft(4 * 86_400_000 + 3_600_000 + 5_000)).toBe("4d 1h");
    expect(fmtTimeLeft(9 * 3_600_000 + 20 * 60_000)).toBe("9h 20m");
    expect(fmtTimeLeft(12 * 60_000 + 5_000)).toBe("12:05");
  });

  it("formats numbers and names", () => {
    expect(fmtVp(12345)).toBe("12,345 VP");
    expect(fmtPct(0.564)).toBe("56%");
    expect(titleCase("IRON 1")).toBe("Iron 1");
    expect(apiColor("5a9fe233")).toBe("#5a9fe2");
    expect(apiColor(null)).toBeUndefined();
    expect(queueName("competitive")).toBe("Competitive");
    expect(queueName("newqueue")).toBe("Newqueue");
  });
});
