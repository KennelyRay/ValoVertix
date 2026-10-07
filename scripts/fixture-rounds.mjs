// Round-by-round match data and an equipped loadout for the fictional demo
// account. Shared by gen-fixtures.mjs and add-fixture-rounds.mjs.

const NAMES = [
  "Kestrel",
  "Sable",
  "Pyrite",
  "Nimbus",
  "Quill",
  "Vesper",
  "Basalt",
  "Ferro",
  "Lumen",
  "Orrin",
  "Tamsin",
  "Juno",
  "Wren",
  "Cobalt",
  "Marlo",
  "Ember",
];

// Rifles and sidearms dominate kills, as in real games.
const WEAPON_WEIGHTS = [
  ["vandal", 30],
  ["phantom", 22],
  ["sheriff", 8],
  ["operator", 7],
  ["spectre", 7],
  ["ghost", 5],
  ["classic", 4],
  ["guardian", 4],
  ["marshal", 3],
  ["judge", 3],
  ["odin", 2],
];

export function addRounds(match, { rand, weaponIds, me }) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const weightedWeapon = () => {
    const total = WEAPON_WEIGHTS.reduce((s, [, w]) => s + w, 0);
    let roll = rand() * total;
    for (const [name, w] of WEAPON_WEIGHTS) if ((roll -= w) < 0) return weaponIds[name];
    return weaponIds.vandal;
  };

  // Names: the demo player keeps theirs; one opponent plays hidden (incognito).
  const usedNames = new Set();
  match.players.forEach((p, i) => {
    if (p.subject === me.puuid) {
      Object.assign(p, { gameName: me.gameName, tagLine: me.tagLine, partyId: "party-demo" });
      return;
    }
    let name = pick(NAMES);
    while (usedNames.has(name)) name = pick(NAMES);
    usedNames.add(name);
    p.gameName = i === 7 ? "" : name;
    p.tagLine = i === 7 ? "" : String(int(100, 9999));
    p.partyId = i === 1 ? "party-demo" : `party-${i}`;
  });

  const [mine, theirs] = [
    match.teams.find((t) => t.teamId === match.players[0].teamId),
    match.teams.find((t) => t.teamId !== match.players[0].teamId),
  ];
  const total = mine.roundsPlayed;
  // Winners in random order, with the match winner taking the last round.
  const winners = [
    ...Array(mine.roundsWon).fill(mine.teamId),
    ...Array(theirs.roundsWon).fill(theirs.teamId),
  ];
  for (let i = winners.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [winners[i], winners[j]] = [winners[j], winners[i]];
  }
  const finalWinner = mine.won ? mine.teamId : theirs.won ? theirs.teamId : null;
  if (finalWinner && winners.at(-1) !== finalWinner) {
    const k = winners.lastIndexOf(finalWinner);
    [winners[k], winners[winners.length - 1]] = [winners[winners.length - 1], winners[k]];
  }

  const rounds = winners.map((winningTeam, roundNum) => ({
    roundNum,
    roundResult: pick(["Eliminated", "Eliminated", "Bomb detonated", "Bomb defused"]),
    winningTeam,
    playerStats: match.players.map((p) => ({ subject: p.subject, kills: [], damage: [] })),
  }));

  // Spread each player's kills over the rounds, each with a victim and hits.
  match.players.forEach((p, pi) => {
    const enemies = match.players.filter((q) => q.teamId !== p.teamId);
    for (let k = 0; k < p.stats.kills; k++) {
      const round = rounds[int(0, total - 1)];
      const victim = pick(enemies).subject;
      const weapon = rand() < 0.88 ? weightedWeapon() : null;
      round.playerStats[pi].kills.push({
        roundTime: int(4_000, 95_000),
        killer: p.subject,
        victim,
        finishingDamage: weapon
          ? { damageType: "Weapon", damageItem: weapon.toUpperCase() }
          : { damageType: "Ability", damageItem: "Ultimate" },
      });
      const headshots = rand() < 0.22 ? int(1, 2) : 0;
      round.playerStats[pi].damage.push({
        receiver: victim,
        damage: 150 - headshots * 10 + int(0, 40),
        headshots,
        bodyshots: int(1, 4),
        legshots: rand() < 0.25 ? 1 : 0,
      });
    }
  });
  // Riot sends one damage entry per target per round.
  for (const round of rounds) {
    for (const ps of round.playerStats) {
      const byReceiver = new Map();
      for (const d of ps.damage) {
        const prev = byReceiver.get(d.receiver);
        if (!prev) byReceiver.set(d.receiver, { ...d });
        else for (const k of ["damage", "headshots", "bodyshots", "legshots"]) prev[k] += d[k];
      }
      ps.damage = [...byReceiver.values()];
    }
  }
  match.roundResults = rounds;
  return match;
}

/** Equips one owned skin per weapon (the default skin when none is owned). */
export function equippedGuns({ weapons, ownedLevelIds, rand }) {
  const owned = new Set(ownedLevelIds.map((id) => id.toLowerCase()));
  return weapons.map((w) => {
    const mine = w.skins.filter(
      (s) => s.uuid !== w.defaultSkinUuid && owned.has(s.levels[0]?.uuid.toLowerCase()),
    );
    const skin = mine.length
      ? mine[Math.floor(rand() * mine.length)]
      : (w.skins.find((s) => s.uuid === w.defaultSkinUuid) ?? w.skins[0]);
    const levels = skin.levels.filter((l) => owned.has(l.uuid.toLowerCase()));
    return {
      ID: w.uuid,
      SkinID: skin.uuid,
      SkinLevelID: (levels.at(-1) ?? skin.levels[0]).uuid,
      ChromaID: skin.chromas[0]?.uuid ?? null,
      Attachments: [],
    };
  });
}
