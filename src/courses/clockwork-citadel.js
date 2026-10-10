import { withCourseExperience } from "./experiences/definitions.js";
import { PATHWAY_EDGES } from "./pathway-edges.js";
import { adventure } from "./adventure-definition.js";
import { buildClockwork } from "./adventure/clockwork-world.js";
// Streets begin at the terrain datum, then climb through supported city levels.
// The watch's opposed gates have long radial leads, so both bowl lines join
// tangentially instead of turning ninety degrees at the lip.
const points = [
  [-245, 8, -160],
  [-160, 8, -190],
  [-60, 10, -180],
  [55, 16, -170],
  [170, 25, -130],
  [235, 32, -65],
  [235, 36, 0],
  [170, 38, 0],
  [130, 40, 0],
  [85, 44, 95],
  [0, 49, 160],
  [-85, 54, 95],
  [-130, 58, 0],
  [-170, 60, 0],
  [-235, 64, 0],
  [-245, 72, -90],
  [-180, 86, -145],
  [-70, 92, -115],
  [50, 96, -70],
  [125, 100, -5],
  [185, 96, 95],
  [260, 80, 175],
  [195, 57, 260],
  [75, 36, 290],
  [-65, 23, 285],
  [-180, 12, 230],
  [-285, 8, 130],
  [-310, 8, 0],
  [-290, 8, -95],
];
const places = [
  [0, "yard", "FOUNDRY YARD", "paving"],
  [2, "spiral", "FOUNDRY ASCENT", "metal"],
  [7, "gears", "GEAR GALLERY", "metal"],
  [13, "clock", "CLOCKMAKERS’ TERRACES", "paving"],
  [19, "crown", "ROOFTOP CROWN", "paving"],
  [21, "descent", "COUNTERWEIGHT DESCENT", "metal"],
  [24, "sweep", "TURBINE SWEEP", "metal"],
  [28, "home", "FOUNDRY RETURN", "paving"],
];
const course = adventure({
  id: "clockwork-citadel",
  pathwayEdges: PATHWAY_EDGES["clockwork-citadel"],
  name: "Clockwork Citadel",
  description:
    "Race from golden foundry streets through a curved watch bowl, climb the clockmakers’ terraces and sweep down through a layered brass city.",
  points,
  rounded: false,
  places,
  palette: ["#94b9cd", "#d4c09a", "#79634b", "#d3c1ab", "#edbb54"],
  targetLength: 2100,
  buildWorld: buildClockwork,
  pads: [
    { section: 0, fraction: 0.65, offset: -3, duration: 0.7 },
    { section: 4, fraction: 0.35, offset: 0, duration: 0.7 },
    { section: 6, fraction: 0.65, offset: 0, duration: 0.8 },
  ],
  theme: {
    sky: "#8bb5ce",
    fog: "#dcc79f",
    ground: "#857159",
    road: "#bcb4ad",
    shoulder: "#c49c57",
    hemisphere: "#b8d8f0",
    ambientGround: "#54455b",
    ambientIntensity: 0.8,
    sun: "#ffcf91",
    sunIntensity: 2.7,
    sunPosition: [-90, 80, -50],
    groundHeight: 7.8,
    terrain: "stone",
    exposure: 1.1,
    fogFar: 1000,
    cameraFar: 1200,
    atmosphere: "clockwork",
    interiorAmbientScale: 0.55,
    lightVolume: {
      resolution: 160,
      columns: 3,
      rows: 2,
      heights: [-35, 8, 35, 65, 100, 145],
      strength: 1.2,
    },
  },
  staticBake: true,
  shortcut: {
    section: 7,
    startFraction: 0.15,
    endFraction: 0.7,
    extraWidth: 0.01,
    material: "paving",
  },
  verges: [
    {
      section: 7,
      startFraction: 0.12,
      endFraction: 0.78,
      side: -1,
      extraWidth: 6,
      material: "metal",
      grip: 12,
      drag: 0.75,
      driveable: true,
    },
  ],
  ambientSources: [
    { section: 0, fraction: 0.5, offset: -35, kind: "engine", range: 100, volume: 0.14 },
    { section: 2, fraction: 0.5, offset: -25, kind: "engine", range: 110, volume: 0.12 },
    { section: 6, fraction: 0.5, offset: -25, kind: "engine", range: 85, volume: 0.18 },
  ],
  elevated: Array.from({ length: 8 }, (_, section) => ({
    section,
    startFraction: 0,
    endFraction: 1,
  })),
  ramps: [{ section: 5, fraction: 0.65, halfLength: 12, height: 0.8 }],
});

// Mario Kart-style flowing bends: the driver keeps steering through the whole
// elevation change, with banking and an exit boost rather than timed boarding.
for (const section of [5, 6]) {
  course.sections[section].bankStrength = 1.2;
  course.sections[section].maxBank = 0.22;
}
export default withCourseExperience(course);
