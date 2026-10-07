import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { buildSkinCatalog, type Contract, type Weapon } from "@valovertix/assets";
import { buildScoreboard, rankedSession, rankHistory } from "@valovertix/calc";
import riot from "@/mocks/fixtures/riot.json";
import staticData from "@/mocks/fixtures/static.json";
import { useWishlist } from "@/features/wishlist/wishlist-store";
import { server } from "./server";
import { renderApp, resetApp, signInFixtureAccount } from "./render";

const catalog = buildSkinCatalog(
  staticData.weapons as Weapon[],
  staticData.contracts as Contract[],
);
const dailySkin = catalog.byLevelId.get(
  riot.storefront.SkinsPanelLayout.SingleItemStoreOffers[0]!.Rewards[0]!.ItemID.toLowerCase(),
)!;

beforeEach(async () => {
  resetApp();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  await signInFixtureAccount();
});

describe("stats extras", () => {
  it("opens a match scoreboard with every player, rounds and the viewer marked", async () => {
    const user = userEvent.setup();
    renderApp("/stats");
    // Label lookups: role queries over the whole stats page are slow in jsdom.
    const list = await screen.findByLabelText("Recent matches", {}, { timeout: 20000 });
    await waitFor(() => expect(list.querySelector("button")).not.toBeNull(), { timeout: 8000 });
    await user.click(list.querySelector("button")!);

    const dialog = await screen.findByRole("dialog", { name: "Match details" });
    const board = buildScoreboard(riot.matches[0]!, riot.puuid);
    expect(await within(dialog).findByText("Your team")).toBeInTheDocument();
    expect(within(dialog).getByText("Enemy team")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("row")).toHaveLength(12); // 2 headers + 10 players
    expect(within(dialog).getByText("You")).toBeInTheDocument();
    expect(within(dialog).getByRole("list", { name: "Rounds" }).children).toHaveLength(
      board.rounds.length,
    );
    // The incognito player shows as their agent, never with a name.
    expect(within(dialog).getByText(/\(hidden\)/)).toBeInTheDocument();
  });

  it("shows headshot rate, ADR, first bloods and a weapons tab", async () => {
    const user = userEvent.setup();
    renderApp("/stats");
    expect(await screen.findByText("Headshot %", {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText("ADR")).toBeInTheDocument();
    expect(screen.getByText("First bloods")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Weapons" }));
    const weapons = screen.getByRole("list", { name: "Kills by weapon" });
    expect(within(weapons).getAllByRole("listitem").length).toBeGreaterThan(3);
    expect(await within(weapons).findByText("Vandal")).toBeInTheDocument();
  });

  it("summarizes the latest ranked session", async () => {
    const session = rankedSession(rankHistory(riot.competitiveUpdates.Matches))!;
    renderApp("/stats");
    const card = await screen.findByRole("region", { name: /ranked session/ }, { timeout: 8000 });
    const net = session.net > 0 ? `+${session.net} RR` : `${session.net} RR`;
    expect(within(card).getByText(net)).toBeInTheDocument();
    expect(within(card).getByRole("list", { name: /RR change per game/ }).children).toHaveLength(
      session.games.length,
    );
  });
});

describe("loadout", () => {
  it("lists the equipped skin for each weapon", async () => {
    const user = userEvent.setup();
    renderApp("/collection");
    await user.click(await screen.findByRole("tab", { name: "Loadout" }, { timeout: 8000 }));
    const vandal = riot.loadout.Guns.find(
      (g) => g.ID === staticData.weapons.find((w) => w.displayName === "Vandal")!.uuid,
    )!;
    const skin = catalog.byId.get(vandal.SkinID.toLowerCase())!;
    const rifles = await screen.findByRole("region", { name: "Rifles" }, { timeout: 8000 });
    expect(within(rifles).getByText(skin.name)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Heavies" })).toBeInTheDocument();
  });

  it("can be shared as a card", async () => {
    const user = userEvent.setup();
    renderApp("/share");
    await user.click(await screen.findByRole("radio", { name: /Loadout/ }, { timeout: 8000 }));
    expect(await screen.findByText("Skins equipped", {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText("My loadout")).toBeInTheDocument();
  });

  it("explains when Riot sends no weapons", async () => {
    server.use(
      http.get("https://pd.*.a.pvp.net/personalization/v3/players/:puuid/playerloadout", () =>
        HttpResponse.json({ Identity: riot.loadout.Identity }),
      ),
    );
    const user = userEvent.setup();
    renderApp("/collection");
    await user.click(await screen.findByRole("tab", { name: "Loadout" }, { timeout: 8000 }));
    expect(
      await screen.findByText("No loadout to show", {}, { timeout: 8000 }),
    ).toBeInTheDocument();
  });
});

describe("wishlist", () => {
  it("adds skins from search and removes them", async () => {
    const user = userEvent.setup();
    renderApp("/collection");
    await user.click(await screen.findByRole("tab", { name: /Wishlist/ }, { timeout: 8000 }));
    expect(await screen.findByText("Nothing on your wishlist yet")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search all skins"), dailySkin.name);
    const results = await screen.findByRole("list", { name: "Search results" });
    const add = within(results).getAllByRole("button", { name: /Add to wishlist/ })[0]!;
    await user.click(add);
    expect(add).toHaveAttribute("aria-pressed", "true");
    expect(useWishlist.getState().ids).toEqual([dailySkin.uuid]);
    expect(screen.getByRole("tab", { name: "Wishlist 1" })).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: `Remove ${dailySkin.name} from wishlist` }),
    );
    expect(useWishlist.getState().ids).toEqual([]);
  });

  it("flags wishlist skins that are in the shop on the store and dashboard", async () => {
    useWishlist.setState({ ids: [dailySkin.uuid] });
    const { unmount } = renderApp("/store");
    const notice = await screen.findByRole(
      "region",
      { name: "Wishlist skins in your shop" },
      { timeout: 8000 },
    );
    expect(within(notice).getByText(dailySkin.name)).toBeInTheDocument();
    expect(within(notice).getByText(/in your daily shop/)).toBeInTheDocument();
    unmount();

    renderApp("/dashboard");
    const dash = await screen.findByRole(
      "region",
      { name: "Wishlist skins in your shop" },
      { timeout: 8000 },
    );
    expect(within(dash).getByRole("link", { name: "Open the store" })).toHaveAttribute(
      "href",
      "/store",
    );
  });

  it("can be added from the store's skin drawer", async () => {
    const user = userEvent.setup();
    renderApp("/store");
    const daily = await screen.findByRole("region", { name: "Daily offers" }, { timeout: 8000 });
    await user.click(
      await within(daily).findByRole("button", { name: new RegExp(dailySkin.name) }),
    );
    const drawer = await screen.findByRole("dialog", { name: dailySkin.name });
    await user.click(within(drawer).getByRole("button", { name: /Add to wishlist/ }));
    expect(useWishlist.getState().ids).toEqual([dailySkin.uuid]);
  });
});

describe("spending extras", () => {
  it("shows the Radianite needed to max every owned skin", async () => {
    renderApp("/spending");
    expect(await screen.findByText(/To max upgrades/, {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText(/levels and variants you don't own yet/)).toBeInTheDocument();
  });
});

describe("polish", () => {
  it("remembers the last tab on a page", async () => {
    const user = userEvent.setup();
    const first = renderApp("/collection");
    await user.click(await screen.findByRole("tab", { name: "Loadout" }, { timeout: 8000 }));
    first.unmount();
    renderApp("/collection");
    expect(await screen.findByRole("tab", { name: "Loadout" }, { timeout: 8000 })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("moves between pages with g-shortcuts and lists them on ?", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/dashboard");
    await screen.findByRole("heading", { level: 1 }, { timeout: 8000 });
    await user.keyboard("gt");
    await waitFor(() => expect(router.state.location.pathname).toBe("/stats"));
    await user.keyboard("?");
    const dialog = await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
    expect(within(dialog).getByText("Go to Collection")).toBeInTheDocument();
  });

  it("ignores shortcuts while typing", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/collection");
    const search = await screen.findByLabelText("Search by name", {}, { timeout: 8000 });
    await user.type(search, "gt");
    expect(router.state.location.pathname).toBe("/collection");
  });

  it("shows when data was loaded and refreshes it", async () => {
    const user = userEvent.setup();
    let mmrCalls = 0;
    server.events.on("request:start", ({ request }) => {
      if (request.url.includes("/mmr/v1/players/") && !request.url.includes("competitiveupdates"))
        mmrCalls += 1;
    });
    renderApp("/stats");
    expect(await screen.findByText("Updated just now", {}, { timeout: 8000 })).toBeInTheDocument();
    const before = mmrCalls;
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(mmrCalls).toBeGreaterThan(before));
    server.events.removeAllListeners();
  });
});
