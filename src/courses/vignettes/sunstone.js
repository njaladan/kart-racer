import { createWaterMaterial } from "../../rendering/surface-detail.js";

/** Old engineering survives as a tipping water clock and an articulated scarab. */
export function buildSunstoneStories(w) {
  const { mat, mesh, box, sphere, cylinder, torus, group, site, tube, motion } = w;
  const stone = mat("#d8ac77"),
    dark = mat("#886142"),
    teal = mat("#468f89", "metal"),
    gold = mat("#d8aa59", "metal", { metalness: 0.65, roughness: 0.35 }),
    water = createWaterMaterial({ scene: w.scene, color: "#6ab6ac", shoreRadius: 7, foam: true });
  const clock = site("Oasis amphora water clock", 0, 0.76, -1, 12, 24);
  for (let i = 0; i < 3; i++) {
    const y = 0.8 + i * 2,
      radius = 8.5 - i * 1.6;
    mesh(cylinder, stone, clock, [0, y, 0], [radius, 1.5, radius]);
    const pool = mesh(new w.THREE.CircleGeometry(radius * 0.8, 40), water, clock, [0, y + 0.77, 0]);
    pool.rotation.x = -Math.PI / 2;
    pool.castShadow = false;
    mesh(
      torus,
      teal,
      clock,
      [0, y + 0.85, 0],
      [radius * 0.9, radius * 0.9, radius * 0.9],
    ).rotation.x = Math.PI / 2;
  }
  for (const x of [-6, 6]) {
    mesh(cylinder, stone, clock, [x, 10, -3], [0.7, 20, 0.7]);
    box(gold, clock, [x, 19.6, -3], [2, 0.7, 2]);
  }
  box(stone, clock, [0, 19, -3], [15, 1.2, 2.4]);
  const vessel = group(clock, [0, 14, 0]);
  const amphora = new w.THREE.LatheGeometry(
    [
      [0.4, -3],
      [1.4, -2.8],
      [2, -1.2],
      [1.7, 0.7],
      [0.65, 1.4],
      [0.7, 2.7],
      [0.95, 2.8],
    ].map((p) => new w.THREE.Vector2(...p)),
    24,
  );
  mesh(amphora, teal, vessel);
  for (const side of [-1, 1]) mesh(torus, gold, vessel, [side * 1.4, 1, 0], [0.8, 1.2, 0.7]);
  motion(vessel, (time) => {
    vessel.rotation.z = Math.sin(time * 0.28) * 0.32;
  });
  for (let i = 0; i < 12; i++) {
    const bead = mesh(sphere, teal, clock, [0, 0, 0], [0.18, 0.32, 0.18]);
    bead.castShadow = false;
    motion(bead, (time) => {
      const q = (((time * 0.35 + i / 12) % 1) + 1) % 1;
      bead.position.set(Math.sin(time * 0.28) * -1.5, 11.3 - q * 5.5, 0.2);
    });
  }
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    box(dark, clock, [Math.cos(a) * 9, 0.9, Math.sin(a) * 9], [0.5, 0.3, 1.2]).rotation.y = -a;
  }

  const shrine = site("Awakening solar scarab", 5, 0.58, 1, 13, 23);
  mesh(cylinder, dark, shrine, [0, 1, 0], [8, 2, 8]);
  mesh(cylinder, stone, shrine, [0, 2.3, 0], [6.5, 0.7, 6.5]);
  mesh(sphere, teal, shrine, [0, 5.7, 0], [3.6, 2.5, 5]);
  mesh(sphere, gold, shrine, [0, 5.4, 5], [2.1, 1.6, 2]);
  for (const side of [-1, 1]) {
    const wing = group(shrine, [side * 0.25, 7, 0]);
    mesh(sphere, gold, wing, [side * 2, 0, 0], [2.2, 0.65, 4.9]);
    for (let j = 0; j < 6; j++)
      box(teal, wing, [side * 2, 0.62, -3.5 + j * 1.4], [3.5, 0.04, 0.12]);
    motion(wing, (time) => {
      wing.rotation.z = side * (0.12 + (0.5 + 0.5 * Math.sin(time * 0.42)) * 1.1);
    });
    for (let j = 0; j < 3; j++) {
      const z = -3 + j * 3;
      tube(shrine, [side * 2.7, 5, z], [side * 5.5, 3.5, z + 1], 0.18, gold);
      tube(shrine, [side * 5.5, 3.5, z + 1], [side * 6.3, 2.6, z + 2], 0.13, gold);
    }
    tube(shrine, [side, 6, 6], [side * 2.6, 7.2, 7.5], 0.13, gold);
  }
  mesh(sphere, gold, shrine, [0, 11, -1], [2.8, 2.8, 0.7]);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    tube(
      shrine,
      [Math.cos(a) * 3, 11 + Math.sin(a) * 3, -1],
      [Math.cos(a) * 4, 11 + Math.sin(a) * 4, -1],
      0.1,
      gold,
    );
  }
}
