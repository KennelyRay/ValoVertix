import { z } from "zod";
import { reportDrift, sanitizeIssues } from "./drift";

/**
 * Schemas only cover the fields the app reads; unknown fields are stripped.
 * Lists are lenient: a malformed element is dropped and reported as drift
 * so the rest of the data can still render.
 */

const id = z.string().min(1);

export function lenientArray<T extends z.ZodType>(item: T, source: string) {
  return z.array(z.unknown()).transform((items) => {
    const out: z.output<T>[] = [];
    const issues: z.core.$ZodIssue[] = [];
    for (const [index, value] of items.entries()) {
      const parsed = item.safeParse(value);
      if (parsed.success) out.push(parsed.data);
      else issues.push(...parsed.error.issues.map((i) => ({ ...i, path: [index, ...i.path] })));
    }
    if (issues.length) reportDrift(sanitizeIssues(source, issues));
    return out;
  });
}

// ---- Auth ----------------------------------------------------------------

export const entitlementsTokenSchema = z.object({ entitlements_token: z.string().min(1) });

export const userInfoSchema = z.object({
  sub: id,
  acct: z.object({ game_name: z.string().optional(), tag_line: z.string().optional() }).nullish(),
});

export const regionSchema = z.object({
  affinities: z.object({ live: z.string() }),
});

// ---- Store ---------------------------------------------------------------

const entitlementItem = z.object({ TypeID: z.string().optional(), ItemID: id });

/**
 * Per-type calls return { ItemTypeID, Entitlements }; the all-types call
 * returns { EntitlementsByTypes }. Both normalize to a list of item IDs.
 */
export const ownedItemsSchema = z
  .union([
    z.object({
      ItemTypeID: z.string(),
      Entitlements: lenientArray(entitlementItem, "ownedItems").nullable(),
    }),
    z.object({
      EntitlementsByTypes: z.array(
        z.object({
          ItemTypeID: z.string(),
          Entitlements: lenientArray(entitlementItem, "ownedItems").nullable(),
        }),
      ),
    }),
  ])
  .transform((value) => {
    const groups = "EntitlementsByTypes" in value ? value.EntitlementsByTypes : [value];
    return groups.flatMap((g) => (g.Entitlements ?? []).map((e) => e.ItemID.toLowerCase()));
  });

const offer = z.object({
  OfferID: z.string(),
  Cost: z.record(z.string(), z.number()),
  Rewards: z.array(
    z.object({ ItemTypeID: z.string(), ItemID: id, Quantity: z.number().optional() }),
  ),
});
export type Offer = z.output<typeof offer>;

export const offersSchema = z.object({ Offers: lenientArray(offer, "offers") });

const storefrontBundleItem = z.object({
  Item: z.object({ ItemTypeID: z.string(), ItemID: id }),
  BasePrice: z.number(),
  CurrencyID: z.string(),
});

/**
 * The v3 storefront, reduced to the same shape as /store/v1/offers so it can
 * stand in for the price list: daily shop offers, every item in the featured
 * bundles at its single-item base price, and Night Market items at their
 * undiscounted price. Only covers what is on sale right now.
 */
export const storefrontSchema = z
  .object({
    FeaturedBundle: z
      .object({
        Bundles: lenientArray(
          z.object({ Items: lenientArray(storefrontBundleItem, "storefront.bundleItems") }),
          "storefront.bundles",
        ).nullish(),
      })
      .nullish(),
    SkinsPanelLayout: z
      .object({ SingleItemStoreOffers: lenientArray(offer, "storefront.daily").nullish() })
      .nullish(),
    BonusStore: z
      .object({
        BonusStoreOffers: lenientArray(z.object({ Offer: offer }), "storefront.nightMarket"),
      })
      .nullish(),
  })
  .transform((sf): Offer[] => [
    ...(sf.SkinsPanelLayout?.SingleItemStoreOffers ?? []),
    ...(sf.BonusStore?.BonusStoreOffers ?? []).map((b) => b.Offer),
    ...(sf.FeaturedBundle?.Bundles ?? []).flatMap((bundle) =>
      bundle.Items.map((i) => ({
        OfferID: `bundle:${i.Item.ItemID}`,
        Cost: { [i.CurrencyID]: i.BasePrice },
        Rewards: [{ ItemTypeID: i.Item.ItemTypeID, ItemID: i.Item.ItemID, Quantity: 1 }],
      })),
    ),
  ]);

export const walletSchema = z.object({ Balances: z.record(z.string(), z.number()) });

// ---- Player --------------------------------------------------------------

export const loadoutSchema = z.object({
  Identity: z.object({
    PlayerCardID: z.string(),
    PlayerTitleID: z.string(),
    AccountLevel: z.number().optional(),
    HideAccountLevel: z.boolean().optional(),
  }),
});

export const accountXpSchema = z.object({
  Progress: z.object({ Level: z.number(), XP: z.number() }),
});

const seasonInfo = z.object({
  SeasonID: z.string(),
  CompetitiveTier: z.number(),
  RankedRating: z.number().default(0),
  NumberOfWins: z.number().default(0),
  NumberOfWinsWithPlacements: z.number().optional(),
  NumberOfGames: z.number().default(0),
  WinsByTier: z.record(z.string(), z.number()).nullish(),
});
export type SeasonInfo = z.output<typeof seasonInfo>;

const competitiveUpdate = z.object({
  MatchID: id,
  MapID: z.string(),
  SeasonID: z.string(),
  MatchStartTime: z.number(),
  TierAfterUpdate: z.number(),
  TierBeforeUpdate: z.number(),
  RankedRatingAfterUpdate: z.number(),
  RankedRatingBeforeUpdate: z.number().optional(),
  RankedRatingEarned: z.number(),
  AFKPenalty: z.number().optional(),
});
export type CompetitiveUpdate = z.output<typeof competitiveUpdate>;

export const mmrSchema = z.object({
  QueueSkills: z
    .record(
      z.string(),
      z.object({
        SeasonalInfoBySeasonID: z.record(z.string(), seasonInfo).nullish(),
      }),
    )
    .nullish(),
  LatestCompetitiveUpdate: competitiveUpdate.nullish().catch(null),
});
export type Mmr = z.output<typeof mmrSchema>;

export const competitiveUpdatesSchema = z.object({
  Matches: lenientArray(competitiveUpdate, "competitiveUpdates"),
});

export const matchHistorySchema = z.object({
  Total: z.number().optional(),
  History: lenientArray(
    z.object({ MatchID: id, GameStartTime: z.number(), QueueID: z.string() }),
    "matchHistory",
  ),
});
export type MatchHistoryEntry = z.output<typeof matchHistorySchema>["History"][number];

const matchPlayer = z.object({
  subject: id,
  teamId: z.string(),
  characterId: z.string().nullish(),
  competitiveTier: z.number().optional(),
  stats: z
    .object({
      score: z.number(),
      roundsPlayed: z.number(),
      kills: z.number(),
      deaths: z.number(),
      assists: z.number(),
    })
    .nullish(),
});

export const matchDetailsSchema = z.object({
  matchInfo: z.object({
    matchId: id,
    mapId: z.string(),
    gameLengthMillis: z.number().nullish(),
    gameStartMillis: z.number(),
    queueID: z.string(),
    isRanked: z.boolean().optional(),
    gameMode: z.string().optional(),
    completionState: z.string().optional(),
  }),
  players: lenientArray(matchPlayer, "matchDetails"),
  teams: z
    .array(
      z.object({
        teamId: z.string(),
        won: z.boolean(),
        roundsWon: z.number(),
        roundsPlayed: z.number().optional(),
      }),
    )
    .nullish(),
});
export type MatchDetails = z.output<typeof matchDetailsSchema>;

export const namesSchema = z.array(
  z.object({ Subject: id, GameName: z.string(), TagLine: z.string() }),
);
