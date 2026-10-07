import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildSkinCatalog, type Contract, type Weapon } from "@valovertix/assets";
import { decodeShareLink, encodeShareLink, resolveOwnedSkins } from "@valovertix/calc";
import { ITEM_TYPE } from "@valovertix/riot";
import riot from "@/mocks/fixtures/riot.json";
import staticData from "@/mocks/fixtures/static.json";
import { useSessionStore } from "@/features/auth/session-store";
import { renderApp, resetApp, signInFixtureAccount } from "./render";

const catalog = buildSkinCatalog(
  staticData.weapons as Weapon[],
  staticData.contracts as Contract[],
);
const owned = resolveOwnedSkins(
  catalog.skins,
  riot.entitlements[ITEM_TYPE.skinLevel],
  riot.entitlements[ITEM_TYPE.skinChroma],
);
const paid = owned.map((o) => o.skin).filter((s) => s.tierId && !s.isContractReward);
const card = () => document.querySelector<HTMLElement>("[data-share-card]")!;

beforeEach(() => {
  resetApp();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("share card extras", () => {
  beforeEach(async () => {
    await signInFixtureAccount();
  });

  it("pages every paid skin across collection cards", async () => {
    const user = userEvent.setup();
    renderApp("/share");
    await user.click(await screen.findByRole("radio", { name: /Collection/ }, { timeout: 20000 }));
    // Story size: 20 skins per card.
    await user.click(screen.getByRole("radio", { name: /Story/ }));
    const pages = Math.ceil(paid.length / 20);
    expect(
      await screen.findByRole(
        "combobox",
        { name: `Card (${pages} for ${paid.length} paid skins)` },
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(card().textContent).toContain(`Card 1 of ${pages}`), {
      timeout: 8000,
    });
    expect(card().textContent).toContain("Paid skins");
    expect(screen.getByRole("button", { name: `Download all ${pages} cards` })).toBeInTheDocument();

    // Battle pass and contract skins never appear.
    const contract = owned.find((o) => o.skin.isContractReward)?.skin;
    if (contract) expect(card().textContent).not.toContain(contract.name);

    await user.click(screen.getByRole("combobox", { name: /^Card \(/ }));
    await user.click(screen.getByRole("option", { name: /^Card 2/ }));
    expect(card().textContent).toContain(`Card 2 of ${pages}`);
  });

  it("applies the style options", async () => {
    const user = userEvent.setup();
    renderApp("/share");
    await screen.findByText("My locker", {}, { timeout: 20000 });
    await waitFor(() => expect(card().textContent).toMatch(/\d VP/), { timeout: 8000 });

    await user.click(screen.getByRole("radio", { name: "Teal" }));
    expect((card().firstElementChild as HTMLElement).style.getPropertyValue("--card-accent")).toBe(
      "#3fd0c9",
    );

    await user.type(screen.getByLabelText("Headline"), "Vandal main");
    expect(card().textContent).toContain("Vandal main");
    expect(card().textContent).not.toContain("My locker");

    await user.click(screen.getByRole("switch", { name: "Show skin prices" }));
    expect(card().textContent).not.toMatch(/\d VP/);
  });

  it("builds a link that holds the paid skins and nothing about the account", async () => {
    const user = userEvent.setup();
    renderApp("/share");
    await user.click(await screen.findByRole("tab", { name: "Share link" }, { timeout: 20000 }));
    const input = await screen.findByLabelText("Link to your collection", {}, { timeout: 20000 });
    await waitFor(() => expect((input as HTMLInputElement).value).toMatch(/\/c#/), {
      timeout: 8000,
    });
    await user.type(screen.getByLabelText(/Name on the preview/), "Ace");
    const value = (input as HTMLInputElement).value;
    const session = useSessionStore.getState().sessions[0]!;
    expect(value).not.toContain(session.puuid);
    expect(value).not.toContain("Demo Player");
    const decoded = decodeShareLink(value.split("#")[1]!)!;
    expect(decoded.name).toBe("Ace");
    expect(decoded.paidOnly).toBe(true);
    expect(decoded.skinPrefixes).toHaveLength(paid.length);
    expect(decoded.vp).toBeNull();
    const battlePass = owned.filter((o) => o.skin.isContractReward && !o.skin.isDefault).length;
    expect(decoded.counts).toMatchObject({
      totalSkins: owned.filter((o) => !o.skin.isDefault).length,
      battlePass,
    });
    // The preview summary shows the same totals.
    const summary = screen.getByRole("region", { name: "Ace" });
    expect(within(summary).getByText(String(battlePass))).toBeInTheDocument();
    expect(within(summary).getByText("Complete bundles")).toBeInTheDocument();
  });
});

describe("shared collection page", () => {
  it("previews a shared link without signing in", async () => {
    const fragment = encodeShareLink({
      skinIds: paid.map((s) => s.uuid),
      name: "Ace",
      vp: 12345,
      paidOnly: true,
      at: Date.UTC(2026, 9, 7),
    });
    renderApp(`/c#${fragment}`);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Ace" }, { timeout: 20000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("12,345 VP")).toBeInTheDocument();
    expect(screen.getByText("ESTIMATE")).toBeInTheDocument();
    const grid = await screen.findByRole("list", { name: "Skins" }, { timeout: 8000 });
    expect(within(grid).getAllByRole("listitem")).toHaveLength(Math.min(40, paid.length));
    expect(screen.getByText(`${paid.length} of ${paid.length} skins`)).toBeInTheDocument();
    if (paid.length > 40) {
      await userEvent.setup().click(screen.getByRole("button", { name: /Show \d+ more/ }));
      expect(within(grid).getAllByRole("listitem").length).toBeGreaterThan(40);
    }
  });

  it("explains a broken link", async () => {
    renderApp("/c#not-a-real-link!");
    expect(
      await screen.findByText("This link doesn't open a collection", {}, { timeout: 20000 }),
    ).toBeInTheDocument();
  });
});

describe("shared collection totals", () => {
  it("shows total skins, complete bundles and battle pass skins from the link", async () => {
    const fragment = encodeShareLink({
      skinIds: paid.map((s) => s.uuid),
      paidOnly: true,
      at: 0,
      counts: { totalSkins: 210, bundles: 12, battlePass: 31 },
    });
    renderApp(`/c#${fragment}`);
    await screen.findByRole("heading", { level: 1 }, { timeout: 20000 });
    const expected: [string, string][] = [
      ["Total skins", "210"],
      ["Complete bundles", "12"],
      ["Battle pass skins", "31"],
    ];
    for (const [label, value] of expected) {
      const term = screen.getByText(label);
      expect(term.parentElement).toHaveTextContent(value);
    }
  });

  it("still opens older links without totals", async () => {
    renderApp(`/c#${encodeShareLink({ skinIds: paid.map((s) => s.uuid), paidOnly: true, at: 0 })}`);
    await screen.findByRole("heading", { level: 1 }, { timeout: 20000 });
    expect(screen.queryByText("Total skins")).not.toBeInTheDocument();
    expect(screen.getByText("Paid skins")).toBeInTheDocument();
  });
});
