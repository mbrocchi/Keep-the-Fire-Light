import { dayNumberOf } from "./time";

/**
 * Answers for the daily puzzle — every word is 5 letters and belongs to the
 * world of the game: family, camping, warmth, bonding, love, connection.
 *
 * Note: `HEARTH` from the original brief is six letters and cannot be a Wordle
 * answer, so `HEART` stands in for it.
 */
export const ANSWERS: readonly string[] = [
  // People and belonging
  "HEART", "CHILD", "UNCLE", "NIECE", "ELDER", "YOUTH", "FOLKS", "TWINS",
  "GUEST", "HOSTS", "GROUP", "TEAMS", "CROWD", "CLANS", "TRIBE", "SCOUT",
  // Bonds and feeling
  "TRUST", "UNITE", "BOUND", "SHARE", "LOVED", "LOVES", "ADORE", "CARES",
  "SWEET", "HAPPY", "MERRY", "JOLLY", "CHEER", "GRINS", "SMILE", "LAUGH",
  "PROUD", "THANK", "GRACE", "FAITH", "HOPES", "DREAM", "PEACE", "NOBLE",
  "BRAVE", "LOYAL", "TRUTH", "GIVEN", "GIFTS", "TREAT", "MERCY", "HONOR",
  // Fire
  "FLAME", "EMBER", "BLAZE", "SPARK", "TORCH", "SMOKE", "ASHES", "COALS",
  "STOKE", "MATCH", "FLINT", "WICKS", "LAMPS", "GLINT", "FLARE", "BURNS",
  "AGLOW", "GLOWS", "SHINE", "LIGHT", "BEAMS", "CRISP", "STUMP", "TWIGS",
  // Camp
  "CABIN", "LODGE", "TENTS", "CAMPS", "CANOE", "PACKS", "BOOTS", "ROPES",
  "KNOTS", "STAKE", "TRAIL", "PATHS", "RIDGE", "CLIFF", "HILLS", "FIELD",
  "PLAIN", "GROVE", "WOODS", "CREEK", "RIVER", "LAKES", "SHORE", "MOSSY",
  "FERNS", "PINES", "CEDAR", "BIRCH", "MAPLE", "LEAFY", "BOUGH", "SPRIG",
  // Sky and night
  "STARS", "NIGHT", "SKIES", "CLOUD", "STORM", "FROST", "CHILL", "LUNAR",
  "DAWNS", "SUNNY", "EARLY", "TODAY", "DAILY", "QUIET", "STILL", "RESTS",
  "SLEEP", "WATCH", "SIGHT", "EARTH", "WORLD",
  // Food and comfort
  "FEAST", "ROAST", "TOAST", "BREAD", "BROTH", "COCOA", "HONEY", "SUGAR",
  "SNACK", "BERRY", "APPLE", "QUILT", "GLEAM", "HOMES", "HOUSE", "ROOMS",
  "NESTS", "ROOTS", "SEEDS", "BLOOM", "PETAL", "DAISY",
  // Telling and listening
  "STORY", "TALES", "SONGS", "MUSIC", "TUNES", "DANCE", "PLAYS", "GAMES",
  "CARDS", "CHESS", "VISIT", "GREET", "WAVES", "CALLS", "NOTES", "WRITE",
  "SPEAK", "VOICE", "WORDS", "TALKS",
];

if (process.env.NODE_ENV !== "production") {
  const bad = ANSWERS.filter((w) => !/^[A-Z]{5}$/.test(w));
  if (bad.length) throw new Error(`words.ts: not 5 uppercase letters: ${bad.join(", ")}`);
  const dupes = ANSWERS.filter((w, i) => ANSWERS.indexOf(w) !== i);
  if (dupes.length) throw new Error(`words.ts: duplicate answers: ${dupes.join(", ")}`);
}

/**
 * The word for a given moment, fixed for the whole UTC day and identical for
 * everyone. The multiply-and-mask is a cheap integer hash: it keeps selection
 * deterministic while stopping consecutive days from marching down the list in
 * order (which would make tomorrow's word guessable from today's).
 */
export function wordForDay(ts: number): string {
  const day = dayNumberOf(ts);
  const hashed = Math.imul(day + 0x9e37, 2654435761) >>> 0;
  return ANSWERS[hashed % ANSWERS.length];
}
