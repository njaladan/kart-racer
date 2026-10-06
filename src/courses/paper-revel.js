import { adventure } from "./adventure-definition.js";
import { buildPaper } from "./adventure/paper-world.js";
const points = Array.from({ length: 32 }, (_, i) => {
  const a = (i / 32) * Math.PI * 2;
  return [Math.sin(a) * 290, 32 + Math.cos(a) * 25, Math.sin(2 * a) * 170];
});
export default adventure({
  id: "paper-revel",
  name: "Paper Revel",
  description:
    "An origami festival of folded valleys and layered crossings. Watch a giant fan unfold a new racing line beneath the lanterns.",
  points,
  places: [
    [0, "lanterns", "LANTERN PROMENADE", "paper"],
    [4, "valley", "CREASE VALLEY", "paper"],
    [8, "pagoda", "PAPER PAGODA", "paper"],
    [12, "fold", "UNFOLDING FAN", "paper"],
    [16, "crossing", "RIBBON CROSSING", "paper"],
    [20, "cranes", "CRANE FLIGHT", "paper"],
    [24, "revel", "FESTIVAL REVEL", "paper"],
    [28, "home", "LANTERN HOMECOMING", "paper"],
  ],
  palette: ["#ffd4d1", "#e3bdd7", "#d394b3", "#fff3d4", "#ec829f"],
  targetLength: 1850,
  buildWorld: buildPaper,
  unfold: { openAfter: 28 },
  staticBake: true,
  ambientSources: [
    { section: 0, fraction: 0.45, offset: -25, kind: "paper", range: 80, volume: 0.1 },
    { section: 3, fraction: 0.5, offset: 15, kind: "paper", range: 90, volume: 0.18 },
    { section: 5, fraction: 0.5, offset: -20, kind: "birds", range: 110, volume: 0.06 },
  ],
  theme: {
    sky: "#ffcfb9",
    fog: "#ecc3d9",
    ground: "#d394b3",
    road: "#fff3d4",
    shoulder: "#bf6e90",
    hemisphere: "#dde8ff",
    ambientGround: "#94758d",
    ambientIntensity: 0.9,
    sun: "#fff1c7",
    sunIntensity: 2.4,
    sunPosition: [-70, 95, 55],
    exposure: 1.15,
    groundHeight: -32,
    terrain: "paper",
    fogFar: 950,
    cameraFar: 1100,
    lightVolume: {
      resolution: 128,
      columns: 3,
      rows: 2,
      heights: [-25, 0, 20, 40, 60, 80],
      strength: 1,
    },
  },
  verges: [
    {
      section: 3,
      startFraction: 0.12,
      endFraction: 0.87,
      side: 1,
      extraWidth: 13,
      material: "paper",
      grip: 12,
      driveable: true,
      gate: "unfold",
    },
  ],
  elevated: Array.from({ length: 8 }, (_, section) => ({
    section,
    startFraction: 0,
    endFraction: 1,
  })),
});
