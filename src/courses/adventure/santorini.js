import { emberwingTownKit } from "./emberwing-town-kit.js";
import { buildEmberwingHarbor } from "./emberwing-harbor.js";
import { buildEmberwingFountain } from "./emberwing-fountain.js";

/** The racing streets pass through connected neighborhoods, squares and gardens. */
export function buildSantorini(w) {
  const { THREE, track, box, mesh, at, motion, tube } = w;
  const art = emberwingTownKit(w);
  const { plaster, cream, blue, coral, wood, leaf, pink, soft, pot, tree, house } = art;
  // Broad inhabited terraces join house foundations instead of separate pillars.
  // Their upper surfaces follow the evaluated route, one metre below the street.
  for (const section of [0, 1, 3, 4, 5, 6, 7]) {
    const width = section === 5 ? 37 : section === 4 ? 40 : 32;
    const terrace = w.sweep(
      section,
      0,
      1,
      -width,
      section === 6 ? (t) => track.platformEdgeAt(t, 1) : width,
      plaster,
      -1.08,
    );
    terrace.name = "Connected whitewashed town terrace";
    const range = track.SECTIONS[section];
    const n = Math.ceil(((range.end - range.start) * track.COURSE_LENGTH) / 4);
    const positions = [],
      indices = [];
    for (const side of [-1, 1]) {
      const base = positions.length / 3;
      for (let i = 0; i <= n; i++) {
        const t = range.start + ((range.end - range.start) * i) / n;
        const p = track.poseAt(
          t * track.TRACK,
          section === 6 && side === 1 ? track.platformEdgeAt(t, 1) : side * width,
          -1.1,
        ).p;
        positions.push(p.x, p.y, p.z, p.x, track.course.theme.groundHeight, p.z);
        if (i < n) {
          const k = base + i * 2;
          indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const facade = mesh(geo, cream);
    facade.name = "Continuous terraced island retaining face";
    facade.material.side = THREE.DoubleSide;
    facade.userData.bakeReceiver = true;
  }
  // Individual frontages are close together, with a second tier behind them.
  for (const section of [0, 1, 3, 4, 6, 7]) {
    const range = track.SECTIONS[section];
    const count = Math.ceil(((range.end - range.start) * track.COURSE_LENGTH) / 17);
    for (let i = 0; i < count; i++)
      for (const side of [-1, 1]) {
        const fraction = (i + 0.5) / count;
        if (section === 0 && fraction > 0.08 && fraction < 0.51) continue;
        if (section === 1 && side === 1 && i % 4 === 0) continue;
        if (section === 3 && fraction < 0.16) continue;
        if (section === 4 && fraction > 0.36 && fraction < 0.51) continue;
        if (section === 6 && side === 1) continue;
        const t = track.sectorT(section, fraction);
        const width = [10, 12, 9, 11][(i + section) % 4];
        const g = w.safe(
          section,
          fraction,
          track.platformEdgeAt(t, side) + side * (width / 2 + 3.2),
          width / 2 + 1.7,
          24,
        );
        if (!g) continue;
        g.name = section === 6 ? "Waterfront taverna frontage" : "Inhabited Cycladic street block";
        // Faces point into the street; mixed heights give the town a roofscape.
        const front = new THREE.Group();
        g.add(front);
        front.rotation.y = (-side * Math.PI) / 2;
        house(front, {
          width,
          depth: 9,
          height: 9 + ((i + section) % 4) * 2,
          chapel: section === 0 && i === 1 && side === -1,
          shop: [0, 1, 6, 7].includes(section) && i % 3 !== 0,
          variant: i + section,
        });
        if (section === 4 || i % 4 === 0) {
          tree(front, width / 2 + 3.5, -2, 0.9);
          pot(front, -width / 2 - 1, 0, 3, true, 1.2);
        }
        if (i % 3 === 1) {
          const back = w.safe(section, fraction, side * 34, 6, 22);
          if (back) {
            back.name = "Layered hillside roof garden";
            back.position.y += 4;
            house(back, { width: 11, height: 8 + (i % 3), depth: 10, variant: i + 1 });
            for (let step = 0; step < 7; step++)
              box(plaster, back, [7.5, -step * 0.5, 4 + step * 1.3], [3, 0.5, 1.3]);
          }
        }
      }
  }
  buildMarket(w, art);
  // Connected garden courts, with actual foliage rather than bare roof props.
  for (const section of [3, 4, 7])
    for (let i = 0; i < 7; i++) {
      const f = (i + 0.5) / 7,
        side = i % 2 ? 1 : -1;
      const g = w.safe(section, f, side * (section === 4 ? 25 : 29), 7, 16);
      if (!g) continue;
      g.name = "Flowering courtyard and olive garden";
      soft(g, cream, [0, -0.25, 0], [14, 0.5, 13]);
      tree(g, -3, 0, 1.3);
      tree(g, 4, -3, 0.9);
      for (let p = 0; p < 5; p++) pot(g, -6 + p * 3, 0, 5, true, 0.8);
      for (const x of [-6, 6]) box(wood, g, [x, 4.3, -4], [0.35, 8.6, 0.35]);
      for (let z = 0; z < 5; z++) {
        box(wood, g, [0, 8.6, -5 + z], [13, 0.25, 0.25]);
        mesh(w.sphere, z % 2 ? pink : leaf, g, [-4 + z * 2, 8.5, -3], [2.1, 0.4, 1.8]);
      }
    }
  // Laundry spans the street above the full chase-camera corridor.
  for (const [section, fractions] of [
    [0, [0.08, 0.82, 0.92]],
    [1, [0.2, 0.58]],
    [7, [0.16, 0.37, 0.62]],
  ]) {
    for (const [row, f] of fractions.entries()) {
      const g = at(section, f),
        t = track.sectorT(section, f);
      const half = Math.max(-track.platformEdgeAt(t, -1), track.platformEdgeAt(t, 1)) + 3;
      const cord = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-half, 12, 0),
        new THREE.Vector3(0, 11.2, 0),
        new THREE.Vector3(half, 12, 0),
      ]);
      mesh(new THREE.TubeGeometry(cord, 20, 0.045, 4, false), wood, g);
      for (let i = 0; i < 7; i++) {
        const cloth = mesh(
          new THREE.PlaneGeometry(2.1, 2.5, 4, 5),
          [plaster, blue, coral][(i + row) % 3],
          g,
          [-half * 0.72 + i * half * 0.24, 10, 0],
        );
        cloth.name = "Breezy overhead laundry";
        cloth.material = cloth.material.clone();
        cloth.material.side = THREE.DoubleSide;
        const rest = Float32Array.from(cloth.geometry.attributes.position.array);
        motion(cloth, (time, state) => {
          const seconds = state?.motionEnabled === false ? 0 : time;
          const positions = cloth.geometry.attributes.position;
          for (let v = 0; v < positions.count; v++) {
            const y = rest[v * 3 + 1];
            positions.setZ(
              v,
              (Math.sin(seconds * 1.5 + i + rest[v * 3] * 0.8) * 0.32 * (1.25 - y)) / 2.5,
            );
          }
          positions.needsUpdate = true;
          cloth.geometry.computeVertexNormals();
        });
      }
    }
  }
  // The volcanic vineyard is low, lush and visibly distinct from town streets.
  for (let i = 0; i < 18; i++) {
    const f = (i + 0.5) / 18;
    const g = w.safe(5, f, -27, 6, 12);
    if (!g) continue;
    g.name = "Stepped obsidian vineyard";
    soft(g, cream, [0, -0.5, 0], [13, 1, 12]);
    for (const x of [-4, 0, 4]) {
      tube(g, [x, 0, -4], [x, 3.1, -4], 0.12, wood);
      tube(g, [x, 0, 4], [x, 3.1, 4], 0.12, wood);
      tube(g, [x, 2.6, -4], [x, 2.6, 4], 0.045, wood);
      for (const z of [-3, 0, 3]) mesh(w.sphere, leaf, g, [x, 2.2, z], [1.4, 1.1, 1.8]);
    }
  }
  const winery = w.safe(5, 0.5, 25, 11, 24);
  if (winery) {
    winery.name = "Vineyard winery courtyard";
    house(winery, { width: 18, depth: 12, height: 12, shop: true, variant: 3 });
    tree(winery, -13, 1, 1.3);
  }
  buildEmberwingFountain(w, art);
  buildEmberwingHarbor(w, art);
}

function buildMarket(w, art) {
  const { THREE, track, mesh, box, at } = w;
  const { plaster, blue, coral, wood, leaf, soft, house, awning, pot } = art;
  // Equal-status streets split around the market pavilion and rejoin in town.
  const centre = at(0, 0.295);
  centre.name = "Central blue-and-coral market pavilion";
  soft(centre, plaster, [0, 1.8, 0], [6.8, 3.6, 13]);
  for (const side of [-1, 1]) {
    const stall = new THREE.Group();
    centre.add(stall);
    stall.rotation.y = (side * Math.PI) / 2;
    awning(stall, 11, 5, 3.8, side < 0 ? blue : coral);
    box(wood, stall, [0, 1.6, 3.8], [10.5, 0.2, 1.8]);
    for (let i = 0; i < 6; i++) {
      box(wood, stall, [-4.4 + i * 1.75, 1.1, 3.8], [1.4, 1.6, 1.2]);
      for (let fruit = 0; fruit < 4; fruit++)
        mesh(
          w.sphere,
          i % 2 ? coral : leaf,
          stall,
          [-4.8 + i * 1.75 + (fruit % 2) * 0.6, 2 + Math.floor(fruit / 2) * 0.3, 3.8],
          [0.28, 0.28, 0.28],
        );
    }
  }
  for (const branch of track.branches.filter((b) => b.group === "village-market")) {
    const side = branch.id === "market-blue-street" ? -1 : 1;
    for (let i = 0; i < 7; i++) {
      const q = 0.15 + i * 0.115;
      const pose = branch.poseAt(q, side * (branch.halfWidth + 8), -1);
      const g = new THREE.Group();
      w.scenery.add(g);
      g.position.copy(pose.p);
      g.rotation.y = track.yawFor(pose.tangent) - (side * Math.PI) / 2;
      g.userData.scenicAssembly = true;
      g.name = "Market street shop frontage";
      house(g, {
        width: 11,
        height: 9 + (i % 3) * 2,
        depth: 9,
        shop: true,
        variant: side < 0 ? i * 2 : i * 2 + 1,
      });
      pot(g, -6.8, 0, 5, true);
    }
  }
}
