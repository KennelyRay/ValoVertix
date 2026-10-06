// Generates the demo/test fixtures in apps/web/src/mocks/fixtures from live
// valorant-api.com data plus a fictional, seeded demo account.
// Usage: pnpm gen:fixtures
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../apps/web/src/mocks/fixtures");
const API = "https://valorant-api.com";

// Mulberry32: tiny seeded PRNG so fixtures are reproducible.
let seed = 0x5eed1234;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const chance = (p) => rand() < p;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const sample = (arr, n) => {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length)
    out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
};
const uuid = () =>
  "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(rand() * 16).toString(16));

async function get(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return (await res.json()).data;
}

const [
  version,
  weapons,
  tiers,
  themes,
  buddies,
  cards,
  sprays,
  titles,
  agents,
  compTiers,
  maps,
  currencies,
  contracts,
] = await Promise.all([
  get("/v1/version"),
  get("/v1/weapons"),
  get("/v1/contenttiers"),
  get("/v1/themes"),
  get("/v1/buddies"),
  get("/v1/playercards"),
  get("/v1/sprays"),
  get("/v1/playertitles"),
  get("/v1/agents?isPlayableCharacter=true"),
  get("/v1/competitivetiers"),
  get("/v1/maps"),
  get("/v1/currencies"),
  get("/v1/contracts"),
]);

const CURRENCY = {
  vp: "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741",
  rad: "e59aa87c-4cbf-517a-5983-6e81511be9b7",
  kc: "85ca954a-41f2-ce94-9b45-8ca3dd39a00d",
};
const ITEM = {
  skinLevel: "e7c63390-eda7-46e0-bb7a-a6abdacd2433",
  skinChroma: "3ad1b2b2-acdb-4524-852f-954a76ddae0a",
  agent: "01bb38e1-da47-4e6a-9b3d-945fe4655707",
  buddy: "dd3bf334-87f3-40bd-b043-682a57a8dc3a",
  spray: "d5f120f8-ff8c-4aac-92ea-f2b5acbe9475",
  card: "3f296c07-64c3-494c-923b-fe692a4fa1bd",
  title: "de7caa6b-adf7-4588-bbd1-143831e786c6",
};
const tierName = Object.fromEntries(tiers.map((t) => [t.uuid, t.devName]));
const GUN_PRICE = { Select: 875, Deluxe: 1275, Premium: 1775, Exclusive: 2175, Ultra: 2475 };
const MELEE_PRICE = { Select: 1750, Deluxe: 2550, Premium: 3550, Exclusive: 4350, Ultra: 4950 };

// ---- Skins ----------------------------------------------------------------

const contractLevels = new Set();
for (const c of contracts)
  for (const ch of c.content.chapters ?? [])
    for (const r of [...ch.levels.map((l) => l.reward), ...(ch.freeRewards ?? [])])
      if (r.type === "EquippableSkinLevel") contractLevels.add(r.uuid);

const allSkins = weapons.flatMap((w) =>
  w.skins.map((s) => ({
    weapon: w,
    skin: s,
    isDefault: s.uuid === w.defaultSkinUuid || /^(Standard|Random Favorite)/.test(s.displayName),
    isContract: s.levels.some((l) => contractLevels.has(l.uuid)),
  })),
);
const candidates = allSkins.filter((s) => !s.isDefault);
const contractSkins = sample(
  candidates.filter((s) => s.isContract),
  24,
);
const storeSkins = sample(
  candidates.filter((s) => !s.isContract && s.skin.contentTierUuid),
  170,
);
const owned = [...storeSkins, ...contractSkins];
// A few store-tier skins with no current offer (event/exclusive drops).
const noOffer = new Set(sample(storeSkins, 6).map((s) => s.skin.uuid));

const ownedLevels = [];
const ownedChromas = [];
const offers = [];
const offer = (itemType, itemId, cost) =>
  offers.push({
    OfferID: itemId,
    IsDirectPurchase: true,
    StartDate: "2020-06-02T00:00:00Z",
    Cost: cost,
    Rewards: [{ ItemTypeID: itemType, ItemID: itemId, Quantity: 1 }],
  });

for (const { weapon, skin, isContract } of owned) {
  const tier = tierName[skin.contentTierUuid];
  const upgradable = skin.levels.length > 1 && ["Premium", "Exclusive", "Ultra"].includes(tier);
  const levelsOwned =
    upgradable && chance(0.6) ? skin.levels.length : upgradable && chance(0.5) ? 2 : 1;
  skin.levels.slice(0, levelsOwned).forEach((l) => ownedLevels.push(l.uuid));
  if (levelsOwned === skin.levels.length)
    for (const c of skin.chromas.slice(1)) if (chance(0.5)) ownedChromas.push(c.uuid);

  if (!isContract && !noOffer.has(skin.uuid) && tier) {
    const table = weapon.displayName === "Melee" ? MELEE_PRICE : GUN_PRICE;
    offer(ITEM.skinLevel, skin.levels[0].uuid, { [CURRENCY.vp]: table[tier] });
  }
  skin.levels
    .slice(1)
    .forEach((l, i) => offer(ITEM.skinLevel, l.uuid, { [CURRENCY.rad]: 10 + 5 * Math.min(i, 2) }));
  skin.chromas.slice(1).forEach((c) => offer(ITEM.skinChroma, c.uuid, { [CURRENCY.rad]: 15 }));
}

// ---- Other collectibles ------------------------------------------------------

const paidAgents = agents.filter((a) => !a.isBaseContent);
const ownedAgents = sample(paidAgents, Math.max(1, paidAgents.length - 5));
const ownedBuddies = sample(buddies, 42);
const ownedCards = sample(
  cards.filter((c) => c.wideArt && c.largeArt),
  64,
);
const ownedSprays = sample(sprays, 51);
const ownedTitles = sample(
  titles.filter((t) => t.titleText),
  33,
);
const equippedCard = ownedCards[0];
const equippedTitle = ownedTitles[0];

// ---- Ranked history ------------------------------------------------------------

const PUUID = "0d3e5a1b-7c2f-4e8a-9b6d-1f2a3c4d5e6f";
const compMaps = maps.filter((m) =>
  [
    "Ascent",
    "Bind",
    "Haven",
    "Split",
    "Lotus",
    "Sunset",
    "Icebox",
    "Breeze",
    "Pearl",
    "Abyss",
    "Fracture",
    "Corrode",
  ].includes(m.displayName),
);
const seasons = Array.from({ length: 6 }, uuid);
const now = Date.UTC(2026, 9, 5, 12);
let tier = 17;
let rr = 62;
const updates = [];
for (let i = 0; i < 20; i++) {
  const won = chance(0.56);
  const delta = won ? 14 + Math.floor(rand() * 12) : -(10 + Math.floor(rand() * 10));
  const before = { tier, rr };
  rr += delta;
  if (rr >= 100 && tier < 27) {
    tier += 1;
    rr -= 100;
  } else if (rr < 0 && tier > 3) {
    tier -= 1;
    rr += 100;
  } else rr = Math.max(0, Math.min(rr, 99));
  updates.push({
    MatchID: uuid(),
    MapID: pick(compMaps).mapUrl,
    SeasonID: seasons[5],
    MatchStartTime: now - (20 - i) * 9 * 3600_000,
    TierAfterUpdate: tier,
    TierBeforeUpdate: before.tier,
    RankedRatingAfterUpdate: rr,
    RankedRatingBeforeUpdate: before.rr,
    RankedRatingEarned: delta,
    RankedRatingPerformanceBonus: 0,
    CompetitiveMovement: "MOVEMENT_UNKNOWN",
    AFKPenalty: 0,
    won,
  });
}
const latest = updates[updates.length - 1];
const seasonal = Object.fromEntries(
  seasons.map((s, i) => {
    const final = i === 5 ? latest.TierAfterUpdate : [12, 14, 16, 18, 21][i];
    return [
      s,
      {
        SeasonID: s,
        NumberOfWins: 20 + i * 4,
        NumberOfWinsWithPlacements: 22 + i * 4,
        NumberOfGames: 40 + i * 7,
        Rank: 0,
        CapstoneWins: 0,
        LeaderboardRank: 0,
        CompetitiveTier: final,
        RankedRating: i === 5 ? latest.RankedRatingAfterUpdate : 30,
        WinsByTier: { [String(final)]: 6, [String(final - 1)]: 9 },
        GamesNeededForRating: 0,
        TotalWinsNeededForRank: 0,
      },
    ];
  }),
);
const mmr = {
  Version: 1,
  Subject: PUUID,
  NewPlayerExperienceFinished: true,
  QueueSkills: {
    competitive: {
      TotalGamesNeededForRating: 0,
      TotalGamesNeededForLeaderboard: 0,
      CurrentSeasonGamesNeededForRating: 0,
      SeasonalInfoBySeasonID: seasonal,
    },
    unrated: {
      TotalGamesNeededForRating: 0,
      TotalGamesNeededForLeaderboard: 0,
      CurrentSeasonGamesNeededForRating: 0,
      SeasonalInfoBySeasonID: null,
    },
  },
  LatestCompetitiveUpdate: (({ won: _w, ...u }) => u)(latest),
  IsLeaderboardAnonymized: false,
  IsActRankBadgeHidden: false,
};

// ---- Matches -----------------------------------------------------------------------

const mains = sample(agents, 5);
const matches = updates
  .slice()
  .reverse()
  .map((u) => {
    const myTeam = chance(0.5) ? "Blue" : "Red";
    const enemy = myTeam === "Blue" ? "Red" : "Blue";
    const loserRounds = Math.floor(rand() * 12);
    const winnerRounds = loserRounds >= 12 ? loserRounds + 2 : 13;
    const rounds = winnerRounds + loserRounds;
    const players = Array.from({ length: 10 }, (_, i) => {
      const me = i === 0;
      const kills = me ? 8 + Math.floor(rand() * 22) : 5 + Math.floor(rand() * 20);
      return {
        subject: me ? PUUID : uuid(),
        teamId: i < 5 ? myTeam : enemy,
        characterId: me ? pick(chance(0.7) ? mains.slice(0, 2) : mains).uuid : pick(agents).uuid,
        competitiveTier: u.TierBeforeUpdate,
        stats: {
          score: kills * 230 + Math.floor(rand() * 900),
          roundsPlayed: rounds,
          kills,
          deaths: 8 + Math.floor(rand() * 14),
          assists: Math.floor(rand() * 11),
          playtimeMillis: rounds * 100_000,
        },
      };
    });
    return {
      matchInfo: {
        matchId: u.MatchID,
        mapId: u.MapID,
        gameLengthMillis: rounds * 100_000,
        gameStartMillis: u.MatchStartTime,
        provisioningFlowID: "Matchmaking",
        isCompleted: true,
        queueID: "competitive",
        gameMode: "/Game/GameModes/Bomb/BombGameMode.BombGameMode_C",
        isRanked: true,
        seasonId: u.SeasonID,
        completionState: "Completed",
      },
      players,
      teams: [
        {
          teamId: myTeam,
          won: u.won,
          roundsPlayed: rounds,
          roundsWon: u.won ? winnerRounds : loserRounds,
          numPoints: 0,
        },
        {
          teamId: enemy,
          won: !u.won,
          roundsPlayed: rounds,
          roundsWon: u.won ? loserRounds : winnerRounds,
          numPoints: 0,
        },
      ],
    };
  });

const riot = {
  puuid: PUUID,
  gameName: "Demo Player",
  tagLine: "DEMO",
  region: "ap",
  entitlements: {
    [ITEM.skinLevel]: ownedLevels,
    [ITEM.skinChroma]: ownedChromas,
    [ITEM.agent]: ownedAgents.map((a) => a.uuid),
    [ITEM.buddy]: ownedBuddies.map((b) => b.levels[0].uuid),
    [ITEM.spray]: ownedSprays.map((s) => s.uuid),
    [ITEM.card]: ownedCards.map((c) => c.uuid),
    [ITEM.title]: ownedTitles.map((t) => t.uuid),
  },
  offers: { Offers: offers },
  wallet: { Balances: { [CURRENCY.vp]: 1240, [CURRENCY.rad]: 35, [CURRENCY.kc]: 12450 } },
  loadout: {
    Subject: PUUID,
    Version: 1,
    Guns: [],
    Sprays: [],
    Identity: {
      PlayerCardID: equippedCard.uuid,
      PlayerTitleID: equippedTitle.uuid,
      AccountLevel: 214,
      PreferredLevelBorderID: "00000000-0000-0000-0000-000000000000",
      HideAccountLevel: false,
    },
    Incognito: false,
  },
  accountXp: { Version: 1, Subject: PUUID, Progress: { Level: 214, XP: 3150 }, History: [] },
  mmr,
  competitiveUpdates: {
    Version: 1,
    Subject: PUUID,
    Matches: updates.map(({ won: _w, ...u }) => u).reverse(),
  },
  matchHistory: {
    Subject: PUUID,
    BeginIndex: 0,
    EndIndex: 20,
    Total: 20,
    History: matches.map((m) => ({
      MatchID: m.matchInfo.matchId,
      GameStartTime: m.matchInfo.gameStartMillis,
      QueueID: "competitive",
    })),
  },
  matches,
};

// ---- Trimmed static data (only what the demo account touches) ----------------------

const ownedSkinIds = new Set(owned.map((o) => o.skin.uuid));
const pickFields = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k] ?? null]));
const staticData = {
  version: { ...pickFields(version, ["riotClientVersion", "branch"]), version: "demo-fixture" },
  weapons: weapons.map((w) => ({
    ...pickFields(w, ["uuid", "displayName", "category", "defaultSkinUuid", "displayIcon"]),
    skins: w.skins
      .filter((s) => ownedSkinIds.has(s.uuid) || s.uuid === w.defaultSkinUuid)
      .map((s) => ({
        ...pickFields(s, [
          "uuid",
          "displayName",
          "themeUuid",
          "contentTierUuid",
          "displayIcon",
          "wallpaper",
        ]),
        chromas: s.chromas.map((c) =>
          pickFields(c, [
            "uuid",
            "displayName",
            "displayIcon",
            "fullRender",
            "swatch",
            "streamedVideo",
          ]),
        ),
        levels: s.levels.map((l) =>
          pickFields(l, ["uuid", "displayName", "levelItem", "displayIcon", "streamedVideo"]),
        ),
      })),
  })),
  contentTiers: tiers.map((t) =>
    pickFields(t, ["uuid", "displayName", "devName", "rank", "highlightColor", "displayIcon"]),
  ),
  themes: themes.map((t) => pickFields(t, ["uuid", "displayName"])),
  buddies: ownedBuddies.map((b) => ({
    ...pickFields(b, ["uuid", "displayName", "displayIcon"]),
    levels: b.levels.map((l) => ({ uuid: l.uuid })),
  })),
  playerCards: ownedCards.map((c) =>
    pickFields(c, ["uuid", "displayName", "displayIcon", "smallArt", "wideArt", "largeArt"]),
  ),
  sprays: ownedSprays.map((s) => ({
    ...pickFields(s, ["uuid", "displayName", "displayIcon", "fullTransparentIcon"]),
    levels: s.levels.map((l) => ({ uuid: l.uuid })),
  })),
  titles: ownedTitles.map((t) => pickFields(t, ["uuid", "displayName", "titleText"])),
  agents: agents.map((a) => ({
    ...pickFields(a, ["uuid", "displayName", "displayIcon", "displayIconSmall", "isBaseContent"]),
    role: a.role ? { displayName: a.role.displayName } : null,
  })),
  // Every tier table: older acts used different numbering (see buildTierNormalizer).
  competitiveTiers: compTiers.map((set) => ({
    uuid: set.uuid,
    tiers: set.tiers.map((t) =>
      pickFields(t, ["tier", "tierName", "divisionName", "color", "smallIcon", "largeIcon"]),
    ),
  })),
  maps: maps.map((m) => pickFields(m, ["uuid", "displayName", "mapUrl", "listViewIcon", "splash"])),
  currencies: currencies.map((c) => pickFields(c, ["uuid", "displayName", "displayIcon"])),
  contracts: contracts
    .map((c) => ({
      uuid: c.uuid,
      content: {
        relationType: c.content.relationType,
        chapters: (c.content.chapters ?? []).map((ch) => ({
          levels: ch.levels
            .filter(
              (l) => contractLevels.has(l.reward.uuid) && l.reward.type === "EquippableSkinLevel",
            )
            .map((l) => ({ reward: { type: l.reward.type, uuid: l.reward.uuid } })),
          freeRewards: null,
        })),
      },
    }))
    .filter((c) => c.content.chapters.some((ch) => ch.levels.length)),
};

await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, "riot.json"), JSON.stringify(riot));
await writeFile(join(OUT, "static.json"), JSON.stringify(staticData));
console.log(
  `Wrote fixtures: ${owned.length} skins (${contractSkins.length} contract, ${noOffer.size} no-offer), ${offers.length} offers, ${matches.length} matches`,
);
