import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildSkinCatalog, type Contract, type Weapon } from "@valovertix/assets";
import { groupByCollection, resolveOwnedSkins } from "@valovertix/calc";
import { ITEM_TYPE } from "@valovertix/riot";
import riot from "@/mocks/fixtures/riot.json";
import staticData from "@/mocks/fixtures/static.json";
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
const allGroups = groupByCollection(catalog.skins, owned);
const isFree = (g: (typeof allGroups)[number]) =>
  (g.skins.length ? g.skins : g.owned.map((o) => o.skin)).every(
    (s) => s.isContractReward || !s.tierId,
  );
// Free (battle pass / contract) collections are hidden by default.
const groups = allGroups.filter((g) => !isFree(g));
const freeGroups = allGroups.filter(isFree);
const themeName = (id: string) =>
  staticData.themes.find((t) => t.uuid.toLowerCase() === id)?.displayName ?? "";
// A collection that matches a real store bundle in the fixtures (Abyssal).
const bundled = groups.find((g) =>
  staticData.bundles.some(
    (b) => b.displayName.toLowerCase() === themeName(g.themeId).toLowerCase(),
  ),
)!;

beforeEach(async () => {
  resetApp();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  await signInFixtureAccount();
});

describe("bundles tab", () => {
  it("hides battle pass and free collections until the switch is turned off", async () => {
    expect(freeGroups.length).toBeGreaterThan(0);
    const user = userEvent.setup();
    renderApp("/collection");
    await user.click(
      await screen.findByRole("tab", { name: `Bundles ${groups.length}` }, { timeout: 8000 }),
    );
    expect(
      await screen.findByText(
        new RegExp(`${freeGroups.length} free collections hidden`),
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();
    const freeName = themeName(freeGroups[0]!.themeId);
    expect(
      screen.queryByRole("button", { name: new RegExp(`^${freeName}`) }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "Hide battle pass and free collections" }));
    expect(screen.getByText(new RegExp(`of ${allGroups.length} collections`))).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: `Bundles ${allGroups.length}` })).toBeInTheDocument();
  });

  it("lists collections with progress and opens the skin list", async () => {
    const user = userEvent.setup();
    renderApp("/collection");
    await user.click(await screen.findByRole("tab", { name: /^Bundles/ }, { timeout: 8000 }));
    const name = themeName(bundled.themeId);
    const card = await screen.findByRole("button", { name: new RegExp(name) }, { timeout: 8000 });
    const progress =
      bundled.owned.length >= bundled.skins.length
        ? "Complete"
        : `${bundled.owned.length} / ${bundled.skins.length} skins`;
    expect(within(card).getByText(progress)).toBeInTheDocument();

    await user.click(card);
    const dialog = await screen.findByRole("dialog", { name });
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(bundled.skins.length);
    expect(within(dialog).getAllByText("Owned")).toHaveLength(bundled.owned.length);
  });

  it("filters to complete collections", async () => {
    const user = userEvent.setup();
    renderApp("/collection");
    await user.click(await screen.findByRole("tab", { name: /^Bundles/ }, { timeout: 8000 }));
    await screen.findByText(/collections, \d+ complete/, {}, { timeout: 8000 });
    await user.click(screen.getByRole("combobox", { name: "Show" }));
    await user.click(screen.getByRole("option", { name: /^Complete/ }));
    const complete = groups.filter((g) => g.owned.length >= g.skins.length).length;
    expect(
      screen.getByText(new RegExp(`^${complete} of ${groups.length} collections`)),
    ).toBeInTheDocument();
  });
});
