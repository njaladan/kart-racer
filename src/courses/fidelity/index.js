import { artKit } from "./art-kit.js";
import { tempestArt } from "./tempest.js";
import { pantryArt } from "./pantry.js";
import { railstormArt } from "./railstorm.js";
import { metronomeArt } from "./metronome.js";
import { pelagicArt } from "./pelagic.js";
import { emberwingArt } from "./emberwing.js";

export const ADVENTURE_ART = {
  "tempest-causeway": tempestArt,
  "pocket-pantry": pantryArt,
  "railstorm-express": railstormArt,
  "metronome-hall": metronomeArt,
  "pelagic-glasshouse": pelagicArt,
  "emberwing-observatory": emberwingArt,
};

export function buildAdventureArt(context) {
  const builder = ADVENTURE_ART[context.track.course.id];
  if (!builder) return null;
  const w = artKit(context);
  builder(w);
  return w.finish();
}
