import { afterEach, describe, expect, it, vi } from "vitest";
import { createRiotClient, fetchEntitlementsToken, fetchRegion, fetchUserInfo } from "./client";
import { onSchemaDrift } from "./drift";
import { CLIENT_PLATFORM, ITEM_TYPE, PD_PATHS } from "./endpoints";
import { RiotApiError, parseRetryAfter } from "./errors";
import { storefrontPrices } from "./schemas";
import { regionToShard } from "./shard";

const PUUID = "11111111-2222-3333-4444-555555555555";
const session = {
  accessToken: "acc.tok.en",
  entitlementsToken: "ent.tok.en",
  clientVersion: "release-13.06-shipping-18-5590001",
  puuid: PUUID,
  shard: "ap" as const,
};

function mockFetch(body: unknown, init: ResponseInit = {}) {
  return vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(body), { status: 200, ...init }),
  );
}

afterEach(() => vi.restoreAllMocks());

describe("regionToShard", () => {
  it.each([
    ["na", "na"],
    ["latam", "na"],
    ["br", "na"],
    ["eu", "eu"],
    ["ap", "ap"],
    ["kr", "kr"],
    [" AP ", "ap"],
  ])("%s -> %s", (region, shard) => expect(regionToShard(region)).toBe(shard));

  it("returns null for unknown regions", () => {
    expect(regionToShard("mars")).toBeNull();
    expect(regionToShard("")).toBeNull();
    expect(regionToShard(undefined)).toBeNull();
  });
});

describe("pd client", () => {
  it("sends exactly the four Riot headers to the right shard", async () => {
    const f = mockFetch({ Balances: { a: 1 } });
    await createRiotClient(session, f).wallet();
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe(`https://pd.ap.a.pvp.net/store/v1/wallet/${PUUID}`);
    expect(init!.headers).toEqual({
      Authorization: "Bearer acc.tok.en",
      "X-Riot-Entitlements-JWT": "ent.tok.en",
      "X-Riot-ClientVersion": session.clientVersion,
      "X-Riot-ClientPlatform": CLIENT_PLATFORM,
    });
    expect(init!.credentials).toBe("omit");
    expect(init!.referrerPolicy).toBe("no-referrer");
  });

  it("normalizes both owned-items response shapes", async () => {
    const perType = mockFetch({
      ItemTypeID: ITEM_TYPE.skinLevel,
      Entitlements: [{ TypeID: ITEM_TYPE.skinLevel, ItemID: "AAA" }],
    });
    expect(await createRiotClient(session, perType).ownedItems("skinLevel")).toEqual(["aaa"]);

    const byTypes = mockFetch({
      EntitlementsByTypes: [{ ItemTypeID: "x", Entitlements: [{ ItemID: "b" }, { ItemID: "c" }] }],
    });
    expect(await createRiotClient(session, byTypes).ownedItems("agent")).toEqual(["b", "c"]);

    const empty = mockFetch({ ItemTypeID: "x", Entitlements: null });
    expect(await createRiotClient(session, empty).ownedItems("title")).toEqual([]);
  });

  it("sends the name-service body as a JSON array via PUT", async () => {
    const f = mockFetch([{ Subject: PUUID, GameName: "Ace", TagLine: "PH1" }]);
    const names = await createRiotClient(session, f).names([PUUID]);
    expect(names[0]?.GameName).toBe("Ace");
    const init = f.mock.calls[0]![1]!;
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(JSON.stringify([PUUID]));
  });

  it.each([
    [401, "auth"],
    [403, "forbidden"],
    [404, "not_found"],
    [429, "rate_limit"],
    [503, "server"],
    [400, "bad_request"],
  ])("maps HTTP %i to %s", async (status, kind) => {
    const f = mockFetch({}, { status, headers: { "Retry-After": "2" } });
    const err = await createRiotClient(session, f)
      .offers()
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RiotApiError);
    expect((err as RiotApiError).kind).toBe(kind);
    expect((err as RiotApiError).retryAfterMs).toBe(2000);
  });

  it("never puts the URL or PUUID in error messages", async () => {
    const f = mockFetch({}, { status: 500 });
    const err = (await createRiotClient(session, f)
      .mmr()
      .catch((e: unknown) => e)) as Error;
    expect(err.message).not.toContain(PUUID);
    expect(err.message).not.toContain("pvp.net");
  });

  it("maps fetch failures to network errors and rethrows aborts", async () => {
    const failing = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(createRiotClient(session, failing).offers()).rejects.toMatchObject({
      kind: "network",
    });
    const aborting = vi.fn(async () => {
      throw new DOMException("aborted", "AbortError");
    });
    await expect(createRiotClient(session, aborting).offers()).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("reports sanitized schema drift without values or IDs", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const drift = vi.fn();
    const off = onSchemaDrift(drift);
    const f = mockFetch({ Balances: { [PUUID]: "lots" } });
    const err = (await createRiotClient(session, f)
      .wallet()
      .catch((e: unknown) => e)) as RiotApiError;
    off();
    expect(err.kind).toBe("schema");
    expect(err.issues?.[0]).toEqual({
      source: "store.wallet",
      path: "Balances.{id}",
      code: "invalid_type",
    });
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain(PUUID);
    expect(logged).not.toContain("lots");
    expect(drift).toHaveBeenCalledOnce();
  });

  it("drops malformed list items but keeps the rest", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = mockFetch({
      Offers: [
        {
          OfferID: "a",
          Cost: { vp: 875 },
          Rewards: [{ ItemTypeID: "t", ItemID: "a", Quantity: 1 }],
        },
        { OfferID: "b", Cost: "free" },
      ],
    });
    const offers = await createRiotClient(session, f).offers();
    expect(offers.map((o) => o.OfferID)).toEqual(["a"]);
  });

  it("passes cancellation during the body read through, without reporting drift", async () => {
    const drift = vi.fn();
    const off = onSchemaDrift(drift);
    const f = vi.fn(async () => {
      const res = new Response("{}", { status: 200 });
      vi.spyOn(res, "json").mockRejectedValue(new DOMException("aborted", "AbortError"));
      return res;
    });
    await expect(createRiotClient(session, f).offers()).rejects.toMatchObject({
      name: "AbortError",
    });
    off();
    expect(drift).not.toHaveBeenCalled();
  });

  it("treats invalid JSON as schema drift", async () => {
    const f = vi.fn(async () => new Response("<html>maintenance</html>", { status: 200 }));
    await expect(createRiotClient(session, f).offers()).rejects.toMatchObject({ kind: "schema" });
  });

  it("refuses non-UUID path segments", () => {
    expect(() => PD_PATHS.matchDetails("../../evil")).toThrow(TypeError);
    expect(() => PD_PATHS.wallet("abc")).toThrow(TypeError);
    expect(() => PD_PATHS.matchHistory(PUUID, 5, 5)).toThrow(RangeError);
  });

  it("builds every path", () => {
    const m = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(PD_PATHS.competitiveUpdates(PUUID)).toBe(
      `/mmr/v1/players/${PUUID}/competitiveupdates?startIndex=0&endIndex=20&queue=competitive`,
    );
    expect(PD_PATHS.matchHistory(PUUID)).toBe(
      `/match-history/v1/history/${PUUID}?startIndex=0&endIndex=20`,
    );
    expect(PD_PATHS.matchDetails(m)).toBe(`/match-details/v1/matches/${m}`);
    expect(PD_PATHS.loadout(PUUID)).toBe(`/personalization/v3/players/${PUUID}/playerloadout`);
    expect(PD_PATHS.loadoutV2(PUUID)).toBe(`/personalization/v2/players/${PUUID}/playerloadout`);
    expect(PD_PATHS.accountXp(PUUID)).toBe(`/account-xp/v1/players/${PUUID}`);
  });
});

describe("auth calls", () => {
  it("exchanges the access token for an entitlements token", async () => {
    const f = mockFetch({ entitlements_token: "ent" });
    expect(await fetchEntitlementsToken("acc", f)).toBe("ent");
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("https://entitlements.auth.riotgames.com/api/token/v1");
    expect(init!.method).toBe("POST");
  });

  it("reads userinfo and region", async () => {
    expect(
      (
        await fetchUserInfo(
          "acc",
          mockFetch({ sub: PUUID, acct: { game_name: "A", tag_line: "B" } }),
        )
      ).sub,
    ).toBe(PUUID);
    const f = mockFetch({ token: "x", affinities: { pbe: "na", live: "ap" } });
    expect(await fetchRegion("acc", "id", f)).toBe("ap");
    expect(f.mock.calls[0]![1]!.body).toBe(JSON.stringify({ id_token: "id" }));
  });
});

describe("parseRetryAfter", () => {
  it("handles seconds, dates and garbage", () => {
    expect(parseRetryAfter("3")).toBe(3000);
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter("soon")).toBeUndefined();
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 4_000)).toBe(6000);
  });
});

describe("loadout", () => {
  const identity = { PlayerCardID: "card", PlayerTitleID: "title", AccountLevel: 214 };

  it("reads the v3 loadout", async () => {
    const f = mockFetch({ Identity: identity });
    expect((await createRiotClient(session, f).loadout()).PlayerCardID).toBe("card");
    expect(String(f.mock.calls[0]![0])).toContain("/personalization/v3/");
  });

  it("falls back to v2 when v3 returns 404", async () => {
    const f = vi.fn(async (url: RequestInfo | URL) =>
      String(url).includes("/v3/")
        ? new Response("{}", { status: 404 })
        : new Response(JSON.stringify({ Identity: identity }), { status: 200 }),
    );
    expect((await createRiotClient(session, f).loadout()).AccountLevel).toBe(214);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("does not retry v2 for other errors", async () => {
    const f = mockFetch({}, { status: 500 });
    await expect(createRiotClient(session, f).loadout()).rejects.toMatchObject({ kind: "server" });
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe("storefront", () => {
  it("POSTs to v3 and flattens daily, Night Market and bundle prices", async () => {
    const VPID = "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741";
    const T = "e7c63390-eda7-46e0-bb7a-a6abdacd2433";
    const offer = (item: string, vp: number) => ({
      OfferID: item,
      IsDirectPurchase: true,
      StartDate: "2026-01-01T00:00:00Z",
      Cost: { [VPID]: vp },
      Rewards: [{ ItemTypeID: T, ItemID: item, Quantity: 1 }],
    });
    const f = mockFetch({
      FeaturedBundle: {
        Bundle: {},
        Bundles: [
          {
            ID: "bundle-1",
            DataAssetID: "ASSET-1",
            Items: [
              {
                Item: { ItemTypeID: T, ItemID: "b1", Amount: 1 },
                BasePrice: 1775,
                CurrencyID: VPID,
                DiscountedPrice: 1500,
              },
            ],
          },
        ],
      },
      SkinsPanelLayout: { SingleItemOffers: ["d1"], SingleItemStoreOffers: [offer("d1", 875)] },
      BonusStore: {
        BonusStoreOffers: [
          { BonusOfferID: "x", Offer: offer("n1", 2175), DiscountCosts: { [VPID]: 900 } },
        ],
      },
    });
    const sf = await createRiotClient(session, f).storefront();
    expect(sf.daily.offers).toHaveLength(1);
    expect(sf.bundles[0]?.items[0]).toMatchObject({
      itemId: "b1",
      basePrice: 1775,
      discountedPrice: 1500,
    });
    expect(sf.nightMarket?.offers[0]).toMatchObject({ discountPercent: 0, isSeen: false });
    const offers = storefrontPrices(sf);
    expect(offers.map((o) => [o.Rewards[0]?.ItemID, o.Cost[VPID]])).toEqual([
      ["d1", 875],
      ["n1", 2175],
      ["b1", 1775],
    ]);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe(`https://pd.ap.a.pvp.net/store/v3/storefront/${PUUID}`);
    expect(init!.method).toBe("POST");
    expect(init!.body).toBe("{}");
  });

  it("copes with a storefront missing sections", async () => {
    const sf = await createRiotClient(session, mockFetch({ SkinsPanelLayout: null })).storefront();
    expect(sf).toEqual({
      daily: { offers: [], remainingSeconds: null },
      bundles: [],
      nightMarket: null,
    });
    expect(storefrontPrices(sf)).toEqual([]);
  });
});
