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
const groups = groupByCollection(catalog.skins, owned);
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
