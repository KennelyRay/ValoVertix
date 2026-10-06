import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import {
  computeSpending,
  indexOffers,
  resolveOwnedSkins,
  vpToMoneyRange,
  formatMoneyRange,
} from "@valovertix/calc";
import { buildSkinCatalog, type Contract, type Weapon } from "@valovertix/assets";
import { CURRENCY, ITEM_TYPE } from "@valovertix/riot";
import riot from "@/mocks/fixtures/riot.json";
import staticData from "@/mocks/fixtures/static.json";
import { VP_PACKS_PHP, vpRate } from "@/config/vp-prices";
import { useSessionStore } from "@/features/auth/session-store";
import { server } from "./server";
import { renderApp, resetApp, signInFixtureAccount } from "./render";

// Expected numbers, computed independently from the fixtures.
const catalog = buildSkinCatalog(
  staticData.weapons as Weapon[],
  staticData.contracts as Contract[],
);
const owned = resolveOwnedSkins(
  catalog.skins,
  riot.entitlements[ITEM_TYPE.skinLevel],
  riot.entitlements[ITEM_TYPE.skinChroma],
);
const expected = computeSpending({
  ownedSkins: owned,
  offers: indexOffers(
    riot.offers.Offers as unknown as {
      Cost: Record<string, number>;
      Rewards: { ItemID: string }[];
    }[],
  ),
  currency: { vp: CURRENCY.vp, radianite: CURRENCY.radianite },
});
const pesoRange = formatMoneyRange(vpToMoneyRange(expected.totalVp, vpRate(VP_PACKS_PHP)), {
  locale: "en-PH",
  currency: "PHP",
});

beforeEach(() => {
  resetApp();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("signed-out pages", () => {
  it("landing explains sign-in and offers the demo", async () => {
    renderApp("/");
    expect(
      await screen.findByRole("heading", { name: "See what your arsenal is really worth" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Your Riot password is never entered here/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sign in with Riot/ })).toHaveAttribute(
      "href",
      expect.stringContaining("https://auth.riotgames.com/authorize"),
    );
    expect(screen.getByRole("button", { name: /demo account/i })).toBeInTheDocument();
  });

  it.each(["/dashboard", "/spending", "/stats", "/collection", "/share"])(
    "%s asks to sign in",
    async (path) => {
      renderApp(path);
      expect(await screen.findByRole("button", { name: "Show my account" })).toBeInTheDocument();
    },
  );

  it.each([
    ["/guide", "How to sign in"],
    ["/privacy", "Privacy"],
    ["/terms", "Terms"],
  ])("%s renders", async (path, title) => {
    renderApp(path);
    expect(await screen.findByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByText(/Not endorsed by or affiliated with Riot Games/)).toBeInTheDocument();
  });

  it("guide warns about sharing the URL", async () => {
    renderApp("/guide");
    expect(await screen.findByText("Only paste this URL into apps you trust.")).toBeInTheDocument();
    expect(screen.getByText(/until it expires \(about 1 hour\)/)).toBeInTheDocument();
  });
});

describe("paste-URL sign-in", () => {
  it("rejects a wrong host and clears the field", async () => {
    const user = userEvent.setup();
    renderApp("/");
    const box = await screen.findByLabelText(/Paste the address/);
    await user.type(box, "https://evil.example/#access_token=a.b.c&id_token=a.b.c");
    await user.click(screen.getByRole("button", { name: "Show my account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("isn't from playvalorant.com");
    expect(box).toHaveValue("");
  });

  it("connects a valid URL and lands on the dashboard", async () => {
    const user = userEvent.setup();
    const { fakeAccessUrl } = await import("@valovertix/riot/test-utils");
    renderApp("/");
    const box = await screen.findByLabelText(/Paste the address/);
    await user.click(box);
    await user.paste(fakeAccessUrl({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    await user.click(screen.getByRole("button", { name: "Show my account" }));
    expect(
      await screen.findByRole("heading", { name: "Demo Player#DEMO" }, { timeout: 8000 }),
    ).toBeInTheDocument();
    expect(useSessionStore.getState().sessions[0]?.shard).toBe("ap");
  });

  it("falls back to a region picker when riot-geo fails", async () => {
    server.use(
      http.put("https://riot-geo.pas.si.riotgames.com/pas/v1/product/valorant", () =>
        HttpResponse.error(),
      ),
    );
    const user = userEvent.setup();
    const { fakeAccessUrl } = await import("@valovertix/riot/test-utils");
    renderApp("/");
    await user.click(await screen.findByLabelText(/Paste the address/));
    await user.paste(fakeAccessUrl({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    await user.click(screen.getByRole("button", { name: "Show my account" }));
    const region = await screen.findByLabelText("Region");
    expect(region).toHaveValue("ap");
    await user.selectOptions(region, "eu");
    await user.click(screen.getByRole("button", { name: "Continue with this region" }));
    await waitFor(() => expect(useSessionStore.getState().sessions[0]?.shard).toBe("eu"));
    expect(useSessionStore.getState().sessions[0]?.shardPicked).toBe(true);
  });
});

describe("signed-in pages", () => {
  beforeEach(async () => {
    await signInFixtureAccount();
  });

  it("dashboard shows identity, ranks, wallet and the estimate", async () => {
    renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: "Demo Player#DEMO" })).toBeInTheDocument();
    expect(await screen.findByText(pesoRange, {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getAllByText("ESTIMATE").length).toBeGreaterThanOrEqual(2);
    expect(await screen.findByText("Ascendant 1")).toBeInTheDocument();
    expect(screen.getByText("12,450")).toBeInTheDocument();
    expect(screen.getByText(String(owned.length))).toBeInTheDocument();
  });

  it("spending shows totals, limits and reacts to the agent toggle", async () => {
    const user = userEvent.setup();
    renderApp("/spending");
    expect(
      await screen.findByText(
        `${expected.totalVp.toLocaleString("en-PH")} VP`,
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(pesoRange)).toBeInTheDocument();
    expect(screen.getByText("Based on standard PH VP pack prices.")).toBeInTheDocument();
    expect(
      screen.getByText(`${expected.radianite.toLocaleString("en-PH")} RP`),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "What this can't count" }));
    const popover = screen.getByRole("region", { name: "What this can't count" });
    for (const term of ["Bundle", "Night Market", "Gifts", "Battle pass", "Refunds", "promos"]) {
      expect(popover).toHaveTextContent(new RegExp(term, "i"));
    }

    await user.click(screen.getByRole("switch", { name: /Include agent unlocks/ }));
    const agents = staticData.agents.filter(
      (a) => !a.isBaseContent && riot.entitlements[ITEM_TYPE.agent].includes(a.uuid),
    ).length;
    expect(
      await screen.findByText(`${(expected.totalVp + agents * 1000).toLocaleString("en-PH")} VP`),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /List the \d+ unpriced skins/ }));
    expect(within(document.getElementById("unpriced-list")!).getAllByRole("listitem")).toHaveLength(
      expected.unpriced.length,
    );
  });

  it("stats shows rank, aggregates and lazily loads more matches", async () => {
    const user = userEvent.setup();
    renderApp("/stats");
    expect(
      await screen.findByText(/Across your last 10 loaded matches/, {}, { timeout: 8000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Win rate")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load 10 more matches" }));
    expect(
      await screen.findByText(/Across your last 20 loaded matches/, {}, { timeout: 8000 }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show as table" }));
    expect(screen.getByRole("table", { name: /Rank after each ranked game/ })).toBeInTheDocument();
  });

  it("stats explains an empty match history", async () => {
    server.use(
      http.get("https://pd.*.a.pvp.net/match-history/v1/history/:puuid", () =>
        HttpResponse.json({ Total: 0, History: [] }),
      ),
    );
    renderApp("/stats");
    expect(await screen.findByText("No recent matches", {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it("collection lists skins, filters by name and opens the detail drawer", async () => {
    const user = userEvent.setup();
    renderApp("/collection");
    const search = await screen.findByLabelText("Search by name", {}, { timeout: 8000 });
    expect(screen.getByRole("tab", { name: `Skins ${owned.length}` })).toBeInTheDocument();
    const target = expected.priced[0]!.owned.skin;
    await user.type(search, target.name);
    const card = await screen.findByRole("button", { name: new RegExp(target.name) });
    await user.click(card);
    const dialog = await screen.findByRole("dialog", { name: target.name });
    expect(
      within(dialog).getByText(`${expected.priced[0]!.vp.toLocaleString("en-PH")} VP`),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("tab", { name: /^Buddies/ }));
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
  });

  it("settings lists the account and can forget it", async () => {
    const user = userEvent.setup();
    renderApp("/settings");
    expect(await screen.findByText(/(viewing)/)).toBeInTheDocument();
    expect(screen.getAllByText(/expires in/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /Forget/ }));
    await waitFor(() => expect(useSessionStore.getState().sessions).toHaveLength(0));
    expect(await screen.findByText("No accounts connected")).toBeInTheDocument();
  });

  it("share page renders the card without the Riot ID by default", async () => {
    renderApp("/share");
    expect(
      await screen.findByText("Estimated skin spend", {}, { timeout: 8000 }),
    ).toBeInTheDocument();
    const card = document.querySelector("[data-share-card]")!;
    expect(card.textContent).not.toContain("Demo Player");
    expect(card.textContent).not.toContain(riot.puuid);
    expect(card.textContent).toContain("ESTIMATE");
  });
});

describe("error handling", () => {
  beforeEach(async () => {
    await signInFixtureAccount();
  });

  it("401 stops queries, removes the session and prompts sign-in", async () => {
    server.use(http.get("https://pd.*.a.pvp.net/*", () => HttpResponse.json({}, { status: 401 })));
    renderApp("/dashboard");
    expect(
      await screen.findByText(/Riot stopped accepting this sign-in/, {}, { timeout: 8000 }),
    ).toBeInTheDocument();
    expect(useSessionStore.getState().sessions).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Sign in again" })).toBeInTheDocument();
  });

  it("429 retries with visible status, then recovers", async () => {
    let calls = 0;
    server.use(
      http.get("https://pd.*.a.pvp.net/store/v1/wallet/:puuid", () => {
        calls += 1;
        return calls <= 2
          ? HttpResponse.json({}, { status: 429, headers: { "Retry-After": "0" } })
          : HttpResponse.json(riot.wallet);
      }),
    );
    renderApp("/dashboard");
    expect(
      await screen.findByText(/Riot is limiting requests. Retrying/, {}, { timeout: 8000 }),
    ).toBeInTheDocument();
    expect(await screen.findByText("12,450", {}, { timeout: 12000 })).toBeInTheDocument();
    expect(calls).toBe(3);
  });

  it("schema drift shows partial data and a notice", async () => {
    server.use(
      http.get("https://pd.*.a.pvp.net/store/v1/offers/", () =>
        HttpResponse.json({ Offers: [...riot.offers.Offers, { OfferID: 5, Cost: "free" }] }),
      ),
    );
    renderApp("/spending");
    expect(
      await screen.findByText(
        /Some data couldn't be read. Riot may have changed something/,
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        `${expected.totalVp.toLocaleString("en-PH")} VP`,
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();
  });

  it("5xx shows a maintenance banner", async () => {
    server.use(
      http.get("https://pd.*.a.pvp.net/account-xp/v1/players/:puuid", () =>
        HttpResponse.json({}, { status: 503 }),
      ),
    );
    renderApp("/dashboard");
    expect(
      await screen.findByText(/Riot's servers are having trouble/, {}, { timeout: 12000 }),
    ).toBeInTheDocument();
  });

  it("403 says Riot rejected the request", async () => {
    server.use(
      http.get("https://pd.*.a.pvp.net/mmr/v1/players/:puuid", () =>
        HttpResponse.json({}, { status: 403 }),
      ),
    );
    renderApp("/dashboard");
    expect(
      await screen.findByText(/Riot rejected this request/, {}, { timeout: 8000 }),
    ).toBeInTheDocument();
  });

  it("404 suggests the region picker", async () => {
    server.use(
      http.get("https://pd.*.a.pvp.net/store/v1/wallet/:puuid", () =>
        HttpResponse.json({}, { status: 404 }),
      ),
    );
    renderApp("/dashboard");
    expect(
      await screen.findByText(/If you play in another region/, {}, { timeout: 8000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Switch region" })).toHaveValue("ap");
  });
});
