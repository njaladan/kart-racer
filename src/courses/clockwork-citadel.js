import { withCourseExperience } from "./experiences/definitions.js";
import { PATHWAY_EDGES } from "./pathway-edges.js";
import { adventure } from "./adventure-definition.js";
import { buildClockwork } from "./adventure/clockwork-world.js";
const points = [
  [-220, 8, -150],
  [-140, 8, -170],
];
for (let i = 0; i <= 16; i++) {
  const a = -Math.PI / 2 + (i * Math.PI) / 8,
    r = 125 + i * 1.5;
  points.push([Math.cos(a) * r, 8 + i * 4.9, Math.sin(a) * r]);
}
// One outer descent follows the spiral. Keeping its radius well outside the
// climb removes the old descent/lift/return crossing at the eastern gallery.
points.push(
  [140, 90, -190],
  [255, 82, -135],
  [305, 68, -30],
  [310, 50, 100],
  [240, 32, 220],
  [110, 20, 280],
  [-40, 14, 285],
  [-175, 8, 230],
  [-285, 8, 125],
  [-310, 8, -25],
  [-290, 8, -100],
);
const places = [
  [0, "yard", "FOUNDRY YARD", "paving"],
  [2, "spiral", "THE GREAT SPIRAL", "metal"],
  [7, "gears", "GEAR GALLERY", "metal"],
  [13, "clock", "CLOCK FACE", "paving"],
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
    "Spiral past enormous turning gears, race across the rooftop crown, and boost through a banked turbine sweep back to the foundry.",
  points,
  rounded: false,
  places,
  palette: ["#b2aed1", "#acabc3", "#727180", "#d3c1ab", "#dbb15e"],
  targetLength: 2100,
  buildWorld: buildClockwork,
  pads: [
    { section: 0, fraction: 0.65, offset: -3, duration: 0.7 },
    { section: 4, fraction: 0.35, offset: 0, duration: 0.7 },
    { section: 6, fraction: 0.65, offset: 0, duration: 0.8 },
  ],
  theme: {
    sky: "#7081a8",
    fog: "#c0a6a0",
    ground: "#525774",
    road: "#bcb4ad",
    shoulder: "#c49c57",
    hemisphere: "#b8d8f0",
    ambientGround: "#54455b",
    ambientIntensity: 0.8,
    sun: "#ffcf91",
    sunIntensity: 2.7,
    sunPosition: [-90, 80, -50],
    groundHeight: -26,
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
      heights: [-95, -65, -35, 0, 45, 105],
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
