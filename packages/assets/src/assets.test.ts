import { describe, expect, it, vi } from "vitest";
import {
  buildSkinCatalog,
  cleanName,
  indexBuddies,
  latestTierSet,
  paidAgentIds,
  pickLevelBorder,
  resolveOwned,
  upgradeLabel,
} from "./catalog";
import {
  StaticDataError,
  deleteAssetCache,
  enableAssetCache,
  fetchGameVersion,
  fetchSkin,
  loadStatic,
} from "./client";
import type { Agent, Contract, Weapon } from "./schemas";

const json = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

const themes = { status: 200, data: [{ uuid: "t1", displayName: "Reaver", extra: "stripped" }] };

describe("loadStatic", () => {
  it("fetches once per version and serves the cache afterwards", async () => {
    await deleteAssetCache();
    enableAssetCache();
    const f = json(themes);
    const first = await loadStatic("themes", "v1", { fetch: f });
    expect(first).toEqual([{ uuid: "t1", displayName: "Reaver" }]);
    const second = await loadStatic("themes", "v1", { fetch: f });
    expect(second).toEqual(first);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("refetches on a new version and drops the old entry", async () => {
    await deleteAssetCache();
    enableAssetCache();
    const f = json(themes);
    await loadStatic("themes", "v1", { fetch: f });
    await loadStatic("themes", "v2", { fetch: f });
    await loadStatic("themes", "v1", { fetch: f });
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("raises typed errors", async () => {
    await deleteAssetCache();
    enableAssetCache();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(loadStatic("themes", "x", { fetch: json({}, 500) })).rejects.toBeInstanceOf(
      StaticDataError,
    );
    await expect(loadStatic("themes", "x", { fetch: json({ nope: 1 }) })).rejects.toMatchObject({
      reason: "schema",
    });
    const offline = vi.fn(async () => {
      throw new TypeError("offline");
    });
    await expect(loadStatic("themes", "x", { fetch: offline })).rejects.toMatchObject({
      reason: "network",
    });
  });

  it("stops caching after the cache is deleted", async () => {
    await deleteAssetCache();
    const f = json(themes);
    await loadStatic("themes", "v1", { fetch: f });
    await loadStatic("themes", "v1", { fetch: f });
    expect(f).toHaveBeenCalledTimes(2);
    expect((await indexedDB.databases()).map((d) => d.name)).not.toContain("valovertix-assets");
    enableAssetCache();
  });

  it("fetches a single skin", async () => {
    const f = json({
      status: 200,
      data: {
        uuid: "s1",
        displayName: "Reaver Vandal",
        themeUuid: null,
        contentTierUuid: "t",
        displayIcon: "i.png",
        chromas: [],
        levels: [],
      },
    });
    expect((await fetchSkin("s1", f)).displayName).toBe("Reaver Vandal");
    expect((f.mock.calls as unknown as [string][])[0]?.[0]).toBe(
      "https://valorant-api.com/v1/weapons/skins/s1",
    );
  });

  it("reads the game version", async () => {
    const f = json({
      status: 200,
      data: { riotClientVersion: "release-1", version: "1.0", branch: "b" },
    });
    expect((await fetchGameVersion(f)).riotClientVersion).toBe("release-1");
  });
});

const weapons: Weapon[] = [
  {
    uuid: "W-VANDAL",
    displayName: "Vandal",
    category: "EEquippableCategory::Rifle",
    defaultSkinUuid: "S-STD",
    displayIcon: null,
    skins: [
      {
        uuid: "S-STD",
        displayName: "Standard Vandal",
        themeUuid: null,
        contentTierUuid: null,
        displayIcon: null,
        chromas: [],
        levels: [
          {
            uuid: "L-STD",
            displayName: "Standard Vandal",
            levelItem: null,
            displayIcon: null,
            streamedVideo: null,
          },
        ],
      },
      {
        uuid: "S-REAVER",
        displayName: "Reaver Vandal",
        themeUuid: "T1",
        contentTierUuid: "TIER-P",
        displayIcon: "icon.png",
        chromas: [
          {
            uuid: "C0",
            displayName: "Reaver Vandal",
            displayIcon: null,
            fullRender: null,
            swatch: null,
            streamedVideo: null,
          },
          {
            uuid: "C1",
            displayName: "Reaver Vandal Level 4\n(Variant 1 Red)",
            displayIcon: null,
            fullRender: null,
            swatch: null,
            streamedVideo: null,
          },
        ],
        levels: [
          {
            uuid: "L1",
            displayName: "Reaver Vandal",
            levelItem: null,
            displayIcon: null,
            streamedVideo: null,
          },
          {
            uuid: "L2",
            displayName: "Reaver Vandal Level 2",
            levelItem: "EEquippableSkinLevelItem::VFX",
            displayIcon: null,
            streamedVideo: "v.mp4",
          },
        ],
      },
      {
        uuid: "S-BP",
        displayName: "Pass Vandal",
        themeUuid: null,
        contentTierUuid: null,
        displayIcon: null,
        chromas: [],
        levels: [
          {
            uuid: "L-BP",
            displayName: "Pass Vandal",
            levelItem: null,
            displayIcon: null,
            streamedVideo: null,
          },
        ],
      },
    ],
  },
  {
    uuid: "W-CLASSIC",
    displayName: "Classic",
    category: "EEquippableCategory::Sidearm",
    defaultSkinUuid: "x",
    displayIcon: null,
    skins: [],
  },
];

const contracts: Contract[] = [
  {
    uuid: "c",
    content: {
      relationType: "Season",
      chapters: [
        { levels: [{ reward: { type: "EquippableSkinLevel", uuid: "L-BP" } }], freeRewards: null },
        { levels: [], freeRewards: [{ type: "Spray", uuid: "x" }] },
      ],
    },
  },
  { uuid: "d", content: { relationType: null, chapters: null } },
];

describe("buildSkinCatalog", () => {
  const catalog = buildSkinCatalog(weapons, contracts);

  it("orders weapons by category and indexes skins by level and chroma", () => {
    expect(catalog.weapons.map((w) => w.name)).toEqual(["Classic", "Vandal"]);
    expect(catalog.byLevelId.get("l2")?.name).toBe("Reaver Vandal");
    expect(catalog.byChromaId.get("c1")?.uuid).toBe("s-reaver");
    expect(catalog.byId.size).toBe(3);
  });

  it("flags default and contract skins", () => {
    expect(catalog.byId.get("s-std")?.isDefault).toBe(true);
    expect(catalog.byId.get("s-bp")?.isContractReward).toBe(true);
    expect(catalog.byId.get("s-reaver")).toMatchObject({
      isDefault: false,
      isContractReward: false,
      tierId: "tier-p",
      themeId: "t1",
    });
  });

  it("labels upgrades and cleans names", () => {
    const reaver = catalog.byId.get("s-reaver")!;
    expect(reaver.levels.map((l) => l.upgrade)).toEqual([null, "VFX"]);
    expect(reaver.chromas[1]?.name).toBe("Reaver Vandal Level 4 (Variant 1 Red)");
    expect(upgradeLabel("EEquippableSkinLevelItem::InspectAndKill")).toBe("Inspect & Kill");
    expect(upgradeLabel(null)).toBeNull();
    expect(cleanName(" a\n b ")).toBe("a b");
  });
});

describe("lookups", () => {
  it("maps buddy levels to buddies and dedupes owned items", () => {
    const index = indexBuddies([
      { uuid: "B", displayName: "Buddy", displayIcon: null, levels: [{ uuid: "BL" }] },
    ]);
    expect(resolveOwned(["BL", "b", "unknown"], index)).toHaveLength(1);
  });

  it("uses the newest tier set", () => {
    const tiers = latestTierSet([
      {
        uuid: "old",
        tiers: [
          {
            tier: 3,
            tierName: "OLD",
            divisionName: "",
            color: "",
            smallIcon: null,
            largeIcon: null,
          },
        ],
      },
      {
        uuid: "new",
        tiers: [
          {
            tier: 3,
            tierName: "IRON 1",
            divisionName: "IRON",
            color: "",
            smallIcon: null,
            largeIcon: null,
          },
        ],
      },
    ]);
    expect(tiers.get(3)?.tierName).toBe("IRON 1");
    expect(latestTierSet([]).size).toBe(0);
  });

  it("picks the preferred level border, else the highest unlocked", () => {
    const borders = [
      { uuid: "B1", startingLevel: 1 },
      { uuid: "B200", startingLevel: 200 },
      { uuid: "B220", startingLevel: 220 },
    ];
    expect(pickLevelBorder(borders, 214, undefined)?.uuid).toBe("B200");
    expect(pickLevelBorder(borders, 214, "b220")?.uuid).toBe("B220");
    expect(pickLevelBorder(borders, 214, "00000000-0000-0000-0000-000000000000")?.uuid).toBe(
      "B200",
    );
    expect(pickLevelBorder(borders, undefined, undefined)).toBeUndefined();
  });

  it("excludes free starter agents from paid agents", () => {
    const agents = [
      { uuid: "JETT", displayName: "Jett", isBaseContent: true },
      { uuid: "GEKKO", displayName: "Gekko", isBaseContent: false },
    ] as Agent[];
    expect(paidAgentIds(["jett", "GEKKO", "gekko", "unknown"], agents)).toEqual(["gekko"]);
  });
});
