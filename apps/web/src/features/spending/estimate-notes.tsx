import { InfoPopover } from "@/components/ui/primitives";

export const ESTIMATE_LIMITS = [
  "Bundle discounts: skins bought in a bundle usually cost less than their single price.",
  "Night Market discounts.",
  "Gifts you received or sent.",
  "Battle pass and contract rewards, which have no store price.",
  "Regional or historical price changes since you bought each item.",
  "Refunds.",
  "Payment-method fees, promos and top-up bonuses.",
  "Exact prices when Riot's price list is unavailable: then each skin uses its tier's standard price.",
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

/** Shown when Riot's price list is unavailable and skins are priced by tier. */
export function TierPriceNote({ compact = false }: { compact?: boolean }) {
  return (
    <div role="note" className="border-l-2 border-warn pl-3 text-sm">
      <p className="font-medium">Priced by tier: Riot's store price list isn't available.</p>
      {!compact && (
        <p className="mt-1 text-muted">
          Riot returned no price list for this sign-in, so each skin is counted at the standard list
          price for its tier (for example Premium 1,775 VP, Premium knife 3,550 VP). Exclusive and
          Ultra skins vary, so this estimate is rougher than usual. Radianite upgrade costs can't be
          estimated without the price list.
        </p>
      )}
    </div>
  );
}
