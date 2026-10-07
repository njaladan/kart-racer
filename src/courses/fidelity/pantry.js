/** A miniature route in a sunlit patisserie, with recognisable downloaded foods. */
export function pantryArt(w) {
  const { track, mat, safe, at, asset, box, motion, lamp, beam, particles } = w;
  const wood = mat("#98734f", "wood"),
    teal = mat("#527c77", "stone"),
    brass = mat("#dfbd83", "metal", { metalness: 0.6, roughness: 0.34 });
  const treats = ["croissant", "strawberry", "donut-sprinkles", "cookie-chocolate", "broccoli"];
  for (let section = 0; section < track.SECTIONS.length; section++) {
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? 1 : -1;
      const g = safe(section, (i + 0.5) / 10, side * (27 + (i % 3) * 9), 7);
      if (!g) continue;
      box(wood, g, [0, -1, 0], [14, 2, 13]);
      const food = asset(treats[(section + i) % treats.length], g, [0, 0, 0], 4 + (i % 3) * 2);
      if (food) food.rotation.y = i * 1.8;
      if (i % 3 === 0) {
        asset("mug", g, [9, 0, 0], 7);
        lamp(g, [9, 5, 0], "#ffd9a0", 25, 20);
      }
    }
    const rack = safe(section, 0.65, -62, 18);
    if (rack) {
      for (const x of [-16, 16]) box(teal, rack, [x, 24, 0], [2, 50, 6]);
      for (let level = 0; level < 3; level++) {
        box(wood, rack, [0, 5 + level * 15, 0], [34, 1.8, 16]);
        for (let j = 0; j < 3; j++)
          asset(treats[(j + level + section) % 5], rack, [j * 11 - 11, 6 + level * 15, 0], 7);
      }
      box(brass, rack, [0, 47, -9], [35, 1, 1]);
      lamp(rack, [0, 43, -3], "#ffd49b", 48, 65);
      beam(rack, [0, 48, 0], "#ffd1a2", 42, 12);
    }
  }
  const station = safe(2, 0.4, 100, 35);
  if (station) {
    box(teal, station, [0, -5, 0], [80, 10, 70]);
    asset("kitchencoffeemachine", station, [0, 0, 0], 54);
    asset("rollingpin", station, [-35, 1, 0], 8);
    asset("whisk", station, [32, 2, 0], 15);
  }
  // Tall windows make the surrounding kitchen legible instead of a pink void.
  for (const section of [0, 2, 4]) {
    const g = safe(section, 0.35, 110, 25);
    if (!g) continue;
    box(teal, g, [0, 32, 0], [100, 75, 3]);
    const pane = mat("#ffe6b2", "stone", { emissive: "#ffdd9b", emissiveIntensity: 0.45 });
    for (let i = 0; i < 3; i++) {
      box(pane, g, [i * 28 - 28, 43, -2], [24, 38, 0.3]);
      box(wood, g, [i * 28 - 28, 43, -2.4], [1, 39, 0.3]);
      box(wood, g, [i * 28 - 28, 43, -2.5], [24, 1, 0.3]);
    }
    beam(g, [0, 60, -7], "#ffe6b2", 78, 22, 0.35);
    lamp(g, [0, 35, -15], "#ffe3ab", 100, 60);
  }
  for (let i = 0; i < 10; i++) {
    const g = at(i % track.SECTIONS.length, 0.55, i % 2 ? 24 : -24);
    // A ceiling hook holds each swinging utensil, rather than floating it.
    box(brass, g, [0, 25, 0], [0.15, 12, 0.15]);
    box(wood, g, [0, 31, 0], [4, 0.4, 3]);
    const spoon = asset("whisk", g, [0, 19, 0], 5);
    if (spoon)
      motion(spoon, (time) => {
        spoon.rotation.z = Math.sin(time * 0.6 + i) * 0.09;
      });
  }
  particles({ color: "#ffe9b6", count: 330, size: 0.13, height: 20, speed: 0.25, offset: 8 });
  particles({ color: "#ffc3d3", style: "star", count: 130, size: 0.22, height: 8, offset: 22 });
}
