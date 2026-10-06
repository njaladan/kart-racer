import { adventure } from "./adventure-definition.js";
import { buildClockwork } from "./adventure/clockwork-world.js";
const points = [
  [-220, 8, -120],
  [-140, 8, -170],
];
for (let i = 0; i <= 16; i++) {
  const a = -Math.PI / 2 + (i * Math.PI) / 8,
    r = 125 + i * 1.5;
  points.push([Math.cos(a) * r, 8 + i * 4.9, Math.sin(a) * r]);
}
points.push(
  [160, 90, -185],
  [285, 60, -20],
  [270, 14, 130],
  [100, 14, 225],
  [45, 14, 150],
  [130, 14, 150],
  [130, 88, 150],
  [215, 88, 150],
  [285, 65, 50],
  [275, 35, -160],
  [100, 14, -290],
  [-120, 8, -290],
  [-260, 8, -240],
);
export default adventure({
  id: "clockwork-citadel",
  name: "Clockwork Citadel",
  description:
    "Spiral into a living clock tower, board its sky lift, and dive from the crown through enormous turning gears.",
  points,
  rounded: false,
  places: [
    [0, "yard", "FOUNDRY YARD", "paving"],
    [2, "spiral", "THE GREAT SPIRAL", "metal"],
    [7, "gears", "GEAR GALLERY", "metal"],
    [13, "clock", "CLOCK FACE", "paving"],
    [19, "descent", "COUNTERWEIGHT DESCENT", "metal"],
    [24, "lift", "SKY LIFT", "metal"],
    [25, "crown", "ROOFTOP CROWN", "paving"],
    [29, "home", "FOUNDRY RETURN", "paving"],
  ],
  palette: ["#b2aed1", "#acabc3", "#727180", "#d3c1ab", "#dbb15e"],
  targetLength: 2100,
  buildWorld: buildClockwork,
  traversals: [
    {
      id: "sky-lift",
      kind: "lift",
      section: 5,
      startFraction: 0,
      endFraction: 1,
      duration: 3,
      hold: 1,
      period: 10,
    },
  ],
  routeLinks: [
    { startControl: 23, endControl: 24, kind: "dock" },
    { startControl: 24, endControl: 25, kind: "lift", heading: [1, 0, 0] },
    { startControl: 25, endControl: 26, kind: "dock" },
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
      heights: [-20, 0, 20, 45, 75, 105],
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
    { section: 5, fraction: 0.5, offset: 0, kind: "engine", range: 85, volume: 0.18 },
  ],
  elevated: Array.from({ length: 8 }, (_, section) => ({
    section,
    startFraction: 0,
    endFraction: 1,
  })),
  ramps: [{ section: 6, fraction: 0.72, halfLength: 12, height: 0.8 }],
});
