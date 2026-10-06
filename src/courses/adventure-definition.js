/** Round authored corners once; section indices still refer to original places. */
export function roundedRoute(points) {
  return points.flatMap((p, i) =>
    [points[(i + points.length - 1) % points.length], points[(i + 1) % points.length]].map((n) =>
      p.map((v, j) => v * 0.78 + n[j] * 0.22),
    ),
  );
}
export function adventure({
  id,
  name,
  description,
  points,
  places,
  palette,
  buildWorld,
  rounded = true,
  ...extra
}) {
  const [sky, fog, ground, road, accent] = palette;
  return {
    id,
    name,
    description,
    targetLength: 1700,
    minimumRadius: 18,
    edgeStyle: "adventure",
    staticBake: false,
    topology: "adventure",
    controls: rounded ? roundedRoute(points) : points,
    sections: places.map(([index, id, name, material = "stone", halfWidth = 10], i) => ({
      controlIndex: index * (rounded ? 2 : 1),
      id,
      name,
      hint: "Follow the adventure",
      material,
      halfWidth,
      color: road,
      grip: 12,
      bankStrength: 0.45,
      maxBank: 0.11,
      enclosed: ["hall", "glass", "tunnel", "pantry"].includes(id),
      ...(i === 0 ? { bankStrength: 0 } : {}),
    })),
    ramps: [
      { section: 1, fraction: 0.6, halfLength: 10, height: 0.65 },
      { section: 5, fraction: 0.55, halfLength: 12, height: 0.8 },
    ],
    pads: [
      { section: 0, fraction: 0.65, offset: -3, duration: 0.7 },
      { section: 3, fraction: 0.78, offset: 2.5, duration: 0.7 },
      { section: 5, fraction: 0.85, offset: 0, duration: 0.8 },
    ],
    itemRows: places.map((_, section) => ({ section, fraction: 0.2 })),
    shortcut: {
      section: places.length - 1,
      startFraction: 0.15,
      endFraction: 0.7,
      extraWidth: 9,
      material: "gravel",
    },
    hazard: {
      enabled: false,
      section: 3,
      fraction: 0.5,
      kind: id,
      label: "WORLD MECHANISM",
      parkOffset: 15,
      minOffset: 2,
      halfWidth: 1.35,
      halfLength: 2.15,
      safeLane: -6.5,
      activation: 6,
      period: 12,
      warningSeconds: 2,
    },
    theme: {
      sky,
      fog,
      ground,
      road,
      shoulder: accent,
      hemisphere: "#cde6fa",
      ambientGround: "#696d89",
      sun: "#fff0cb",
      sunIntensity: 2.1,
      exposure: 1.2,
      terrain: "stone",
      groundHeight: -22,
    },
    buildWorld,
    ...extra,
  };
}
