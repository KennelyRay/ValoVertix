/** The skin fields the calculators need. The assets catalog provides a superset. */
export interface SkinRef {
  uuid: string;
  name: string;
  weaponId: string;
  tierId: string | null;
  themeId: string | null;
  /** levels[0] is the base skin that store offers price. */
  levels: readonly { uuid: string }[];
  /** chromas[0] is the base look and comes with the skin. */
  chromas: readonly { uuid: string }[];
  /** Standard / "Random Favorite" placeholder skins every player has. */
  isDefault: boolean;
  /** Awarded by a battle pass, agent contract or event pass. */
  isContractReward: boolean;
}

export interface OwnedSkin<S extends SkinRef = SkinRef> {
  skin: S;
  /** Owned level UUIDs, in catalog order. */
  levelIds: string[];
  /** Owned non-base chroma UUIDs, in catalog order. */
  chromaIds: string[];
}

/** Cost per currency ID, keyed by the rewarded item ID (lowercase). */
export type OfferIndex = ReadonlyMap<string, Readonly<Record<string, number>>>;

export interface OfferLike {
  Cost: Readonly<Record<string, number>>;
  Rewards: readonly { ItemID: string }[];
}
