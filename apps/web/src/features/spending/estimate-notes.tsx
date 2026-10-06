import { InfoPopover } from "@/components/ui/primitives";

export const ESTIMATE_LIMITS = [
  "Bundle discounts: skins bought in a bundle usually cost less than their single price.",
  "Night Market discounts.",
  "Gifts you received or sent.",
  "Battle pass and contract rewards, which have no store price.",
  "Regional or historical price changes since you bought each item.",
  "Refunds.",
  "Payment-method fees, promos and top-up bonuses.",
] as const;

export function EstimateInfo({ label = "What this can't count" }: { label?: string }) {
  return (
    <InfoPopover label={label}>
      <p className="font-medium">Every spending figure is an estimate.</p>
      <p className="mt-1 text-muted">
        It prices each skin you own at its current single-item store offer. It can't see:
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
        {ESTIMATE_LIMITS.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p className="mt-3">Based on standard PH VP pack prices.</p>
    </InfoPopover>
  );
}
