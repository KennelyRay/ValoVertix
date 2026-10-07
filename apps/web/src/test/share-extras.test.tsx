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
    await user.click(screen.getByRole("combobox", { name: "Size" }));
    await user.click(screen.getByRole("option", { name: /Story/ }));
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

    await user.click(screen.getByRole("combobox", { name: "Accent color" }));
    await user.click(screen.getByRole("option", { name: "Teal" }));
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
    const input = await screen.findByLabelText("Your link", {}, { timeout: 20000 });
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
