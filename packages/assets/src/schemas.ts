import { z } from "zod";
import { lenientArray } from "@valovertix/riot";

/** valorant-api.com wraps every payload as { status, data }. */
const envelope = <T extends z.ZodType>(data: T) => z.object({ status: z.number(), data });

const url = z.string().nullable();

export const versionSchema = z.object({
  riotClientVersion: z.string(),
  version: z.string(),
  branch: z.string().optional(),
});

const skinLevel = z.object({
  uuid: z.string(),
  displayName: z.string(),
  levelItem: z.string().nullable(),
  displayIcon: url,
  streamedVideo: url,
});

const skinChroma = z.object({
  uuid: z.string(),
  displayName: z.string(),
  displayIcon: url,
  fullRender: url,
  swatch: url,
  streamedVideo: url,
});

export const skinSchema = z.object({
  uuid: z.string(),
  displayName: z.string(),
  themeUuid: z.string().nullable(),
  contentTierUuid: z.string().nullable(),
  displayIcon: url,
  wallpaper: url.optional(),
  chromas: z.array(skinChroma),
  levels: z.array(skinLevel),
});

const weapon = z.object({
  uuid: z.string(),
  displayName: z.string(),
  category: z.string(),
  defaultSkinUuid: z.string(),
  displayIcon: url,
  skins: lenientArray(skinSchema, "static.weapons.skins"),
});

const contentTier = z.object({
  uuid: z.string(),
  displayName: z.string(),
  devName: z.string(),
  rank: z.number(),
  highlightColor: z.string(),
  displayIcon: url,
});

const theme = z.object({ uuid: z.string(), displayName: z.string() });

const bundle = z.object({
  uuid: z.string(),
  displayName: z.string(),
  displayNameSubText: z.string().nullable(),
  displayIcon: url,
  displayIcon2: url,
  verticalPromoImage: url,
});

const buddy = z.object({
  uuid: z.string(),
  displayName: z.string(),
  displayIcon: url,
  levels: z.array(z.object({ uuid: z.string() })),
});

const levelBorder = z.object({
  uuid: z.string(),
  startingLevel: z.number(),
  levelNumberAppearance: url,
  smallPlayerCardAppearance: url,
});

const playerCard = z.object({
  uuid: z.string(),
  displayName: z.string(),
  displayIcon: url,
  smallArt: url,
  wideArt: url,
  largeArt: url,
});

const spray = z.object({
  uuid: z.string(),
  displayName: z.string(),
  displayIcon: url,
  fullTransparentIcon: url,
  levels: z.array(z.object({ uuid: z.string() })),
});

const title = z.object({
  uuid: z.string(),
  displayName: z.string(),
  titleText: z.string().nullable(),
});

const agent = z.object({
  uuid: z.string(),
  displayName: z.string(),
  displayIcon: url,
  displayIconSmall: url,
  isBaseContent: z.boolean(),
  role: z.object({ displayName: z.string() }).nullable(),
});

const competitiveTierSet = z.object({
  uuid: z.string(),
  tiers: z.array(
    z.object({
      tier: z.number(),
      tierName: z.string(),
      divisionName: z.string(),
      color: z.string(),
      smallIcon: url,
      largeIcon: url,
    }),
  ),
});

const map = z.object({
  uuid: z.string(),
  displayName: z.string(),
  mapUrl: z.string(),
  listViewIcon: url,
  splash: url,
});

const currency = z.object({ uuid: z.string(), displayName: z.string(), displayIcon: url });

const reward = z.object({ type: z.string(), uuid: z.string() });
const contract = z.object({
  uuid: z.string(),
  content: z.object({
    relationType: z.string().nullable(),
    chapters: z
      .array(
        z.object({
          levels: z.array(z.object({ reward })),
          freeRewards: z.array(reward).nullable(),
        }),
      )
      .nullable(),
  }),
});

export const STATIC_RESOURCES = {
  weapons: { path: "/v1/weapons", schema: envelope(lenientArray(weapon, "static.weapons")) },
  contentTiers: { path: "/v1/contenttiers", schema: envelope(z.array(contentTier)) },
  themes: { path: "/v1/themes", schema: envelope(lenientArray(theme, "static.themes")) },
  bundles: { path: "/v1/bundles", schema: envelope(lenientArray(bundle, "static.bundles")) },
  buddies: { path: "/v1/buddies", schema: envelope(lenientArray(buddy, "static.buddies")) },
  playerCards: {
    path: "/v1/playercards",
    schema: envelope(lenientArray(playerCard, "static.playercards")),
  },
  levelBorders: {
    path: "/v1/levelborders",
    schema: envelope(lenientArray(levelBorder, "static.levelborders")),
  },
  sprays: { path: "/v1/sprays", schema: envelope(lenientArray(spray, "static.sprays")) },
  titles: { path: "/v1/playertitles", schema: envelope(lenientArray(title, "static.titles")) },
  agents: {
    path: "/v1/agents?isPlayableCharacter=true",
    schema: envelope(lenientArray(agent, "static.agents")),
  },
  competitiveTiers: { path: "/v1/competitivetiers", schema: envelope(z.array(competitiveTierSet)) },
  maps: { path: "/v1/maps", schema: envelope(lenientArray(map, "static.maps")) },
  currencies: { path: "/v1/currencies", schema: envelope(z.array(currency)) },
  contracts: {
    path: "/v1/contracts",
    schema: envelope(lenientArray(contract, "static.contracts")),
  },
} as const;

export type StaticKey = keyof typeof STATIC_RESOURCES;
export type StaticData<K extends StaticKey> = z.output<
  (typeof STATIC_RESOURCES)[K]["schema"]
>["data"];

export type Weapon = StaticData<"weapons">[number];
export type ApiSkin = Weapon["skins"][number];
export type ContentTier = StaticData<"contentTiers">[number];
export type Theme = StaticData<"themes">[number];
export type Bundle = StaticData<"bundles">[number];
export type Buddy = StaticData<"buddies">[number];
export type PlayerCard = StaticData<"playerCards">[number];
export type LevelBorder = StaticData<"levelBorders">[number];
export type Spray = StaticData<"sprays">[number];
export type PlayerTitle = StaticData<"titles">[number];
export type Agent = StaticData<"agents">[number];
export type CompetitiveTierSet = StaticData<"competitiveTiers">[number];
export type CompetitiveTier = CompetitiveTierSet["tiers"][number];
export type GameMap = StaticData<"maps">[number];
export type Currency = StaticData<"currencies">[number];
export type Contract = StaticData<"contracts">[number];
export type GameVersion = z.output<typeof versionSchema>;
