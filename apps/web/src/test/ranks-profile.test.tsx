import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import riot from "@/mocks/fixtures/riot.json";
import staticData from "@/mocks/fixtures/static.json";
import { server } from "./server";
import { renderApp, resetApp, signInFixtureAccount } from "./render";

const PD = "https://pd.*.a.pvp.net";
const equipped = staticData.playerCards.find(
  (c) => c.uuid.toLowerCase() === riot.loadout.Identity.PlayerCardID.toLowerCase(),
)!;

beforeEach(async () => {
  resetApp();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  await signInFixtureAccount();
});

describe("peak rank across tier tables", () => {
  it("shows an old-act Immortal 3 as Immortal 3, not Ascendant 3", async () => {
    // An act from before the 2022 rework, where tier 23 meant Immortal 3.
    const oldSetId = staticData.competitiveTiers.find((s) =>
      s.tiers.some((t) => t.tier === 23 && t.tierName === "IMMORTAL 3"),
    )!.uuid;
    const oldAct = staticData.competitiveSeasons.find((s) => s.competitiveTiersUuid === oldSetId)!;
    const currentAct = staticData.competitiveSeasons.at(-1)!;
    server.use(
      http.get(`${PD}/mmr/v1/players/:puuid`, () =>
        HttpResponse.json({
          QueueSkills: {
            competitive: {
              SeasonalInfoBySeasonID: {
                [oldAct.seasonUuid]: {
                  SeasonID: oldAct.seasonUuid,
                  CompetitiveTier: 23,
                  RankedRating: 40,
                  WinsByTier: { "23": 4 },
                },
                [currentAct.seasonUuid]: {
                  SeasonID: currentAct.seasonUuid,
                  CompetitiveTier: 23,
                  RankedRating: 12,
                  WinsByTier: { "23": 2 },
                },
              },
            },
          },
          LatestCompetitiveUpdate: null,
        }),
      ),
    );
    renderApp("/dashboard");
    const account = await screen.findByRole("region", { name: "Account" }, { timeout: 8000 });
    expect(
      await within(account).findByText("Immortal 3", {}, { timeout: 8000 }),
    ).toBeInTheDocument();
  });
});

describe("equipped player card", () => {
  it("shows the card from the v3 loadout", async () => {
    renderApp("/dashboard");
    const card = await screen.findByRole("figure", { name: "Equipped player card" });
    expect(
      await within(card).findByText(equipped.displayName, {}, { timeout: 8000 }),
    ).toBeInTheDocument();
  });

  it("falls back to the v2 loadout when v3 returns 404", async () => {
    server.use(
      http.get(`${PD}/personalization/v3/players/:puuid/playerloadout`, () =>
        HttpResponse.json({}, { status: 404 }),
      ),
    );
    renderApp("/dashboard");
    const card = await screen.findByRole("figure", { name: "Equipped player card" });
    expect(
      await within(card).findByText(equipped.displayName, {}, { timeout: 8000 }),
    ).toBeInTheDocument();
  });

  it("says the card couldn't load instead of claiming none is equipped", async () => {
    server.use(
      http.get(`${PD}/personalization/:version/players/:puuid/playerloadout`, () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    );
    renderApp("/dashboard");
    const card = await screen.findByRole("figure", { name: "Equipped player card" });
    expect(
      await within(card).findByText("Couldn't load your card from Riot", {}, { timeout: 12000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText("No title equipped")).not.toBeInTheDocument();
  });
});
