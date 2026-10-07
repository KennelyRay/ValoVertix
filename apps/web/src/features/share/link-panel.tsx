import { useId, useMemo, useRef, useState } from "react";
import { Link2 } from "lucide-react";
import type { CatalogSkin } from "@valovertix/assets";
import {
  SHARE_NAME_MAX,
  SHARE_SKINS_MAX,
  encodeShareLink,
  type ShareCounts,
} from "@valovertix/calc";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { EstimateTag, Panel, Switch } from "@/components/ui/primitives";
import { fmtInt, fmtVp } from "@/lib/format";

const SECTION = "font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted";

/** Builds a link to a read-only preview of the collection. Nothing is uploaded. */
export function ShareLinkPanel({
  skins,
  allSkins,
  totalVp,
  counts,
}: {
  /** Paid skins (no battle pass, contract or free skins). */
  skins: CatalogSkin[];
  /** Every non-default skin owned. */
  allSkins: CatalogSkin[];
  totalVp: number | null;
  /** Totals shown on the preview: all skins, complete bundles, battle pass skins. */
  counts: ShareCounts;
}) {
  const [paidOnly, setPaidOnly] = useState(true);
  const [withValue, setWithValue] = useState(false);
  const [name, setName] = useState("");
  const nameId = useId();
  const linkId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const list = paidOnly ? skins : allSkins;
  const link = useMemo(() => {
    const fragment = encodeShareLink({
      skinIds: list.map((s) => s.uuid),
      name,
      vp: withValue ? totalVp : null,
      paidOnly,
      counts,
      at: Date.now(),
    });
    return `${window.location.origin}/c#${fragment}`;
  }, [list, name, withValue, totalVp, paidOnly, counts]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied.");
    } catch {
      // Clipboard blocked: select it so the user can copy by hand.
      inputRef.current?.select();
      toast.error("Couldn't copy automatically. The link is selected; copy it yourself.");
    }
  }

  const summary = [
    { label: "Total skins", value: fmtInt(counts.totalSkins) },
    {
      label: paidOnly ? "Paid skins listed" : "Skins listed",
      value: fmtInt(Math.min(list.length, SHARE_SKINS_MAX)),
    },
    { label: "Complete bundles", value: fmtInt(counts.bundles) },
    { label: "Battle pass skins", value: fmtInt(counts.battlePass) },
  ];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[21rem_minmax(0,1fr)]">
      <Panel aria-labelledby="link-options" className="space-y-5">
        <h2 id="link-options" className={SECTION}>
          What the link shows
        </h2>
        <div className="space-y-1">
          <Switch
            checked={paidOnly}
            onChange={setPaidOnly}
            label="Paid skins only"
            description="The skin list leaves out battle pass, contract and free skins. The totals always show."
          />
          <Switch
            checked={withValue}
            onChange={setWithValue}
            label="Include the estimated value"
            description={totalVp === null ? "Not available yet." : "Shown as an estimate, in VP."}
          />
        </div>
        <div>
          <label htmlFor={nameId} className={`${SECTION} mb-1 block text-[0.7rem]`}>
            Name on the preview (optional)
          </label>
          <input
            id={nameId}
            value={name}
            maxLength={SHARE_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            placeholder="A nickname, not your Riot ID"
            className="min-h-11 w-full border border-line-strong bg-bg/70 px-3 placeholder:text-faint"
          />
          <p className="mt-1 text-xs text-muted">
            Anyone with the link can read it, so pick something you're happy to share.
          </p>
        </div>
      </Panel>

      <div className="min-w-0 space-y-6">
        <section
          aria-labelledby="link-summary"
          className="panel panel-raised relative overflow-hidden p-5 sm:p-6"
        >
          <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-accent" />
          <p className={SECTION}>What people will see</p>
          <h2 id="link-summary" className="display-xl mt-2 break-words text-4xl sm:text-5xl">
            {name.trim() || "A shared collection"}
          </h2>
          <dl className="mt-5 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
            {summary.map((s) => (
              <div key={s.label} className="bg-surface p-3">
                <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-muted">
                  {s.label}
                </dt>
                <dd className="mt-1 font-display text-3xl font-bold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
          {withValue && totalVp !== null && (
            <p className="mt-3 flex items-center gap-2 text-sm">
              Value: <span className="font-semibold">{fmtVp(totalVp)}</span> <EstimateTag />
            </p>
          )}
        </section>

        <Panel aria-labelledby="link-title">
          <h2 id="link-title" className="flex items-center gap-2 text-xl">
            <Link2 aria-hidden className="size-5 text-accent" />
            Your link
          </h2>
          <label htmlFor={linkId} className="sr-only">
            Link to your collection
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              id={linkId}
              ref={inputRef}
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="min-h-11 min-w-0 flex-1 border border-line-strong bg-bg/70 px-3 font-mono text-xs text-muted"
            />
            <Button variant="primary" onClick={() => void copy()} disabled={list.length === 0}>
              Copy link
            </Button>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center border border-line-strong px-4 text-sm font-semibold hover:border-text"
            >
              Open preview
            </a>
          </div>
          <p className="mt-2 text-xs text-muted">{fmtInt(link.length)} characters</p>
          <p className="mt-4 max-w-2xl text-sm text-muted">
            The skin list lives in the link itself, after the “#”, which browsers don't send to our
            server. Nothing is uploaded or stored, and the link never contains your Riot ID or
            account. It's a snapshot: make a new link after you buy skins.
          </p>
        </Panel>
      </div>
    </div>
  );
}
