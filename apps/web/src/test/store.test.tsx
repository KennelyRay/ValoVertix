import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { buildSkinCatalog, type Contract, type Weapon } from "@valovertix/assets";
import riot from "@/mocks/fixtures/riot.json";
import staticData from "@/mocks/fixtures/static.json";
import { server } from "./server";
import { renderApp, resetApp, signInFixtureAccount } from "./render";

const catalog = buildSkinCatalog(
  staticData.weapons as Weapon[],
  staticData.contracts as Contract[],
);
const skinName = (levelId: string) => catalog.byLevelId.get(levelId.toLowerCase())?.name;
const sf = riot.storefront;

beforeEach(async () => {
  resetApp();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  await signInFixtureAccount();
});

describe("store page", () => {
  it("shows the daily offers with prices and a reset timer", async () => {
    renderApp("/store");
    const daily = await screen.findByRole("region", { name: "Daily offers" }, { timeout: 8000 });
    for (const offer of sf.SkinsPanelLayout.SingleItemStoreOffers) {
      expect(
        await within(daily).findByText(skinName(offer.Rewards[0]!.ItemID)!),
      ).toBeInTheDocument();
    }
    expect(within(daily).getByText(/Resets in \d+h \d+m/)).toBeInTheDocument();
    expect(within(daily).getAllByText(/\d VP$/)).toHaveLength(4);
  });

  it("shows each featured bundle with its items and bundle price", async () => {
    renderApp("/store");
    for (const [i, bundle] of sf.FeaturedBundle.Bundles.entries()) {
      const name = staticData.bundles[i]!.displayName;
      const article = await screen.findByRole("article", { name }, { timeout: 8000 });
      const total = bundle.TotalDiscountedCost["85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741"];
      expect(within(article).getByText(`${total.toLocaleString("en-PH")} VP`)).toBeInTheDocument();
      expect(within(article).getByText(/20% off as a bundle/)).toBeInTheDocument();
      expect(within(article).getAllByRole("listitem")).toHaveLength(bundle.Items.length);
    }
  });

  it("shows the Night Market with discounts and unflipped cards", async () => {
    renderApp("/store");
    const night = await screen.findByRole("region", { name: "Night Market" }, { timeout: 8000 });
    expect(within(night).getByText("−42%")).toBeInTheDocument();
    expect(within(night).getAllByText("Not flipped in game")).toHaveLength(3);
  });

  it("offers a retry when the storefront fails", async () => {
    server.use(
      http.post("https://pd.*.a.pvp.net/store/v3/storefront/:puuid", () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderApp("/store");
    expect(
      await screen.findByText("Couldn't load your store.", {}, { timeout: 12000 }),
    ).toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("region", { name: "Daily offers" }, { timeout: 8000 }),
    ).toBeInTheDocument();
  });
});
