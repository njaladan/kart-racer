import { cutTerrainPassages } from "../../rendering/route-cutout.js";

/** Connected streets and grounded architecture at several inhabited elevations. */
export function buildClockworkCity(w, art) {
  const { THREE, scene, scenery, track, kit, mesh, box, at, cylinder, sphere, torus, motion } = w;
  const { allows, building, gear, pipe, lamp, bronze, iron, pale, masonry, dark, copper, glow } =
    art;
  const ground = track.course.theme.groundHeight;
  const houses = [];
  scene.userData.clockworkHouseSites = houses;
  const cone = new THREE.ConeGeometry(1, 1, 16);
  const arch = new THREE.TorusGeometry(1, 0.12, 6, 24, Math.PI);
  // A continuous pavement under the route replaces disconnected elevated pads.
  // Test the actual triangles against every other floor and the whole bowl.
  for (const section of [0, 1, 3, 4, 5, 6, 7]) {
    const street = w.sweep(section, 0, 1, -53, 53, pale, -0.24);
    street.name = "Connected clockmaker city terrace";
    cutTerrainPassages(street.geometry, allows.corridor);
    street.geometry.computeVertexNormals();
    const underside = w.sweep(section, 0, 1, -53, 53, masonry, -1.4);
    underside.name = "City terrace masonry underside";
    cutTerrainPassages(underside.geometry, allows.corridor);
    underside.geometry.computeVertexNormals();
  }
  // Space complete house footprints, not just their pivots. Courtyards remain
  // at least eight metres wide even where two route neighborhoods approach.
  for (const section of [0, 1, 3, 4, 5, 6, 7]) {
    const span = track.SECTIONS[section];
    const count = Math.max(2, Math.floor(((span.end - span.start) * track.COURSE_LENGTH) / 65));
    for (let i = 0; i < count; i++)
      for (const side of [-1, 1]) {
        const fraction = (i + 0.5) / count;
        const t = track.sectorT(section, fraction);
        const height =
          section === 0 || section === 7 ? ground : Math.max(ground, track.frameAt(t).p.y - 0.2);
        const size = 0.95 + (i % 3) * 0.1;
        let g, envelope;
        const depth = Math.max(0, height - ground);
        for (let attempt = 0; attempt < 14; attempt++) {
          const candidate = at(section, fraction, side * (36 + (i % 2) * 3 + attempt * 9));
          candidate.rotation.set(
            0,
            track.yawFor(track.frameAt(t).tangent) + (side * Math.PI) / 2,
            0,
          );
          candidate.position.y = height;
          candidate.userData.scenicAssembly = false;
          candidate.updateWorldMatrix(true, false);
          const bounds = new THREE.Box3(
            new THREE.Vector3(-17, -depth, -18),
            new THREE.Vector3(17, 35, 18),
          ).applyMatrix4(candidate.matrixWorld);
          if (
            allows(candidate, [0, (35 - depth) / 2, 0], [34, 35 + depth, 36]) &&
            !houses.some((h) => bounds.clone().expandByScalar(4).intersectsBox(h.bounds))
          ) {
            g = candidate;
            envelope = bounds;
            break;
          }
          candidate.removeFromParent();
        }
        if (!g) continue;
        g.name = "Grounded clockmaker house and courtyard";
        g.userData.houseBase = height;
        const pad = box(pale, g, [0, -0.65, 0], [32, 1.3, 34]);
        pad.name = "House courtyard pavement";
        if (depth > 1.3) {
          for (const x of [-12, 12])
            for (const z of [-12, 12]) {
              box(masonry, g, [x, -depth / 2, z], [4, depth, 4]);
              box(bronze, g, [x, -1.8, z], [5, 1, 5]);
            }
          for (const x of [-12, 12])
            mesh(arch, bronze, g, [x, -4, 0], [1, Math.min(9, depth / 2), 12]).rotation.y =
              Math.PI / 2;
        }
        building(g, i, size);
        // Brass machinery integrates the imported houses into the foundry era.
        pipe(g, [-10, 1, 9], [-10, 22 * size, 9], 0.38, bronze);
        mesh(cylinder, copper, g, [-10, 23 * size, 9], [1.3, 3, 1.3]);
        gear(g, [10, 12, 11], 3, side * 0.18, 16);
        gear(g, [14.4, 12, 11], 1.5, -side * 0.36, 16);
        lamp(g, [-12, 3.2, -13], 14);
        // Keep open courts; one small pressure boiler in the back corner.
        mesh(cylinder, bronze, g, [12, 2.2, 12], [1.6, 4.4, 1.6]);
        mesh(sphere, copper, g, [12, 4.4, 12], [1.6, 0.8, 1.6]);
        houses.push({
          section,
          fraction,
          base: height,
          ground,
          bounds: envelope,
          position: g.position.toArray(),
        });
      }
  }
  function imported(name, parent, position, dimensions, material) {
    if (!kit.hasAsset(name)) return null;
    const object = kit.fitAsset(name, parent, position, dimensions);
    object.traverse((o) => {
      if (o.isMesh) o.material = material;
    });
    return object;
  }
  // Complete ground-to-roof industrial towers fill the near and distant city.
  const towers = [];
  for (let i = 0; i < 28; i++) {
    const angle = (i * Math.PI * 2) / 28;
    const radius = 290 + (i % 3) * 65;
    const height = 85 + (i % 5) * 23;
    const width = 19 + (i % 3) * 4;
    const g = new THREE.Group();
    scenery.add(g);
    g.position.set(Math.cos(angle) * radius, ground, Math.sin(angle) * radius);
    g.rotation.y = -angle + Math.PI / 2;
    if (!allows(g, [0, height / 2 + 12, 0], [width * 2 + 14, height + 24, width * 2 + 14])) {
      g.removeFromParent();
      continue;
    }
    g.name = "Golden industrial city tower";
    mesh(cylinder, masonry, g, [0, height / 2, 0], [width, height, width]);
    for (let tier = 0; tier < 5; tier++) {
      const y = 8 + (tier * height) / 5;
      mesh(cylinder, bronze, g, [0, y, 0], [width + 1.5, 1.1, width + 1.5]);
      // Balconies, lit arched windows, and fluted brass columns on every level.
      for (let bay = 0; bay < 8; bay++) {
        const a = (bay * Math.PI) / 4;
        const facade = new THREE.Group();
        g.add(facade);
        facade.position.set(Math.sin(a) * (width + 0.1), y + 6, Math.cos(a) * (width + 0.1));
        facade.rotation.y = a;
        box(dark, facade, [0, 0, 0], [5, 7, 0.25]);
        box(glow, facade, [0, 0, 0.17], [3.6, 5.8, 0.12]);
        mesh(arch, bronze, facade, [0, 3, 0.3], [2.8, 2.2, 1]);
        for (const x of [-3.1, 3.1]) box(bronze, facade, [x, 0, 0], [0.45, 9, 0.7]);
      }
    }
    mesh(sphere, copper, g, [0, height, 0], [width + 0.6, width * 0.75, width + 0.6]);
    mesh(cone, bronze, g, [0, height + width * 0.75, 0], [5, 12, 5]);
    for (const side of [-1, 1]) {
      pipe(g, [side * (width + 3), 0, 4], [side * (width + 3), height + 8, 4], 1.4, bronze);
      for (let y = 12; y < height; y += 18)
        mesh(torus, iron, g, [side * (width + 3), y, 4], [1.8, 1.8, 1.8]).rotation.x = Math.PI / 2;
    }
    gear(g, [0, height * 0.5, width + 3], 10 + (i % 4), i % 2 ? -0.13 : 0.13);
    gear(g, [14, height * 0.5 + 11, width + 3], 7, i % 2 ? 0.19 : -0.19, 20);
    imported("art:chimney-detailed", g, [width - 4, height + 4, 0], [8, 24, 8], bronze);
    towers.push(g);
  }
  // Elevated pedestrian bridges make the skyline read as one city, with
  // explicit all-floor clearance including the crossing's overhead beams.
  for (let i = 0; i < towers.length; i++) {
    if (i % 3 !== 0) continue;
    const a = towers[i].position.clone(),
      b = towers[(i + 1) % towers.length].position.clone();
    const y = 64 + (i % 3) * 19;
    a.y = b.y = y;
    const length = a.distanceTo(b);
    const g = new THREE.Group();
    scenery.add(g);
    g.position.copy(a).add(b).multiplyScalar(0.5);
    g.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    if (!allows(g, [0, 3, 0], [12, 9, length])) {
      g.removeFromParent();
      continue;
    }
    g.name = "Brass skybridge between city levels";
    box(iron, g, [0, 0, 0], [10, 1.4, length]);
    for (const side of [-1, 1]) {
      box(bronze, g, [side * 5, 3, 0], [0.4, 0.5, length]);
      for (let z = -length / 2 + 4; z < length / 2; z += 8)
        pipe(g, [side * 5, 0, z - 4], [side * 5, 3, z + 4], 0.22, bronze);
    }
  }
  // Non-character engines: driven gears, pumping pistons and authored machinery.
  for (const section of [0, 1, 3, 4, 5, 6, 7]) {
    const g = at(section, 0.62, -66);
    g.rotation.set(0, track.yawFor(track.frameAt(track.sectorT(section, 0.62)).tangent), 0);
    g.position.y = ground;
    if (!allows(g, [0, 17, 0], [30, 34, 30])) {
      g.removeFromParent();
      continue;
    }
    g.name = "Rooftop turbine engine";
    box(masonry, g, [0, 1, 0], [29, 2, 28]);
    imported("art:machine-generatorlarge", g, [-3, 2, 0], [18, 10, 15], bronze);
    imported("art:pipe-cornerround", g, [8, 5, 0], [6, 8, 6], copper);
    for (let i = 0; i < 3; i++) {
      mesh(cylinder, iron, g, [-7 + i * 6, 8, -9], [1.4, 12, 1.4]);
      const piston = mesh(cylinder, bronze, g, [-7 + i * 6, 14, -9], [1.7, 2, 1.7]);
      motion(piston, (time) => {
        piston.position.y = 14 + Math.sin(time * 2 + i * 2) * 1.2;
      });
    }
    gear(g, [0, 19, 4], 8, 0.18, 28);
    gear(g, [11, 19, 4], 3, -0.48, 16);
    pipe(g, [-12, 1, 10], [-12, 30, 10], 1, bronze);
    lamp(g, [12, 5, 9], 20);
  }
}
