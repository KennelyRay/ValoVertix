// Adds round data and an equipped loadout to the existing demo fixtures
// without refetching anything. Usage: node scripts/add-fixture-rounds.mjs
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addRounds, equippedGuns } from "./fixture-rounds.mjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../apps/web/src/mocks/fixtures");
const riot = JSON.parse(await readFile(join(OUT, "riot.json"), "utf8"));
const { weapons } = JSON.parse(await readFile(join(OUT, "static.json"), "utf8"));

let seed = 0x0bad5eed;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const SKIN_LEVEL = "e7c63390-eda7-46e0-bb7a-a6abdacd2433";
const weaponIds = Object.fromEntries(weapons.map((w) => [w.displayName.toLowerCase(), w.uuid]));
const me = { puuid: riot.puuid, gameName: riot.gameName, tagLine: riot.tagLine };
for (const m of riot.matches) {
  delete m.roundResults;
  addRounds(m, { rand, weaponIds, me });
}
riot.loadout.Guns = equippedGuns({ weapons, ownedLevelIds: riot.entitlements[SKIN_LEVEL], rand });

await writeFile(join(OUT, "riot.json"), JSON.stringify(riot));
console.log(`Added rounds to ${riot.matches.length} matches and ${riot.loadout.Guns.length} guns`);
