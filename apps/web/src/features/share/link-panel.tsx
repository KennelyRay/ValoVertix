import { useId, useMemo, useRef, useState } from "react";
import { Link2 } from "lucide-react";
import type { CatalogSkin } from "@valovertix/assets";
import { SHARE_NAME_MAX, SHARE_SKINS_MAX, encodeShareLink } from "@valovertix/calc";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { EstimateTag, Panel, Switch } from "@/components/ui/primitives";
import { fmtInt } from "@/lib/format";

/** Builds a link to a read-only preview of the collection. Nothing is uploaded. */
export function ShareLinkPanel({
  skins,
  allSkins,
  totalVp,
}: {
  /** Paid skins (no battle pass, contract or free skins). */
  skins: CatalogSkin[];
  /** Every non-default skin owned. */
  allSkins: CatalogSkin[];
  totalVp: number | null;
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
      at: Date.now(),
    });
    return `${window.location.origin}/c#${fragment}`;
  }, [list, name, withValue, totalVp, paidOnly]);

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

  return (
    <Panel aria-labelledby="link-title" className="mt-6">
      <h2 id="link-title" className="flex items-center gap-2 text-xl">
        <Link2 aria-hidden className="size-5 text-accent" />
        Share a link instead
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Anyone with the link sees a preview of your skins, no image needed. The skin list lives in
        the link itself, after the “#”, which browsers don't send to our server. Nothing is uploaded
        or stored, and the link never contains your Riot ID or account.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <Switch
            checked={paidOnly}
            onChange={setPaidOnly}
            label="Paid skins only"
            description="Leaves out battle pass, contract and free skins."
          />
          <Switch
            checked={withValue}
            onChange={setWithValue}
            label="Include the estimated value"
            description={
              totalVp === null ? "Not available yet." : "Shown on the preview as an estimate."
            }
          />
        </div>
        <div>
          <label
            htmlFor={nameId}
            className="mb-1 block font-display text-xs font-semibold uppercase tracking-[0.08em] text-muted"
          >
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
      </div>

      <label htmlFor={linkId} className="sr-only">
        Your link
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
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
      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        {fmtInt(Math.min(list.length, SHARE_SKINS_MAX))} skins · {fmtInt(link.length)} characters
        {withValue && totalVp !== null && <EstimateTag />}
      </p>
    </Panel>
  );
}
