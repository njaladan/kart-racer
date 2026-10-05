import { installSurfaceDetail } from "../../rendering/surface-detail.js";

/** Broad sculpted ridge strips, shaped saddles and multiple distant layers. */
export function buildMountainHorizon({ THREE, scenery, kit, textures }) {
  const stone = kit.material("#d9e6ef", { map: textures.snow, roughness: 1 });
  stone.name = "Alpine ridge snow and weathered blue strata";
  installSurfaceDetail(stone, { kind: "terrain", scale: 0.019, strength: 0.11 });
  function ridgeGeometry(seed, length, depth, height) {
    const vertices = [],
      uv = [],
      indices = [],
      colors = [];
    const nx = 68,
      nz = 18;
    for (let z = 0; z <= nz; z++) {
      const v = z / nz;
      for (let x = 0; x <= nx; x++) {
        const u = x / nx;
        const spine = 0.53 + Math.sin(u * 13 + seed) * 0.13 + Math.cos(u * 31 + seed * 0.3) * 0.09;
        const cross = Math.max(0, 1 - Math.abs(v - spine) / 0.54);
        const peaks =
          0.36 +
          Math.pow(Math.sin(u * 9 + seed) * 0.5 + 0.5, 1.4) * 0.4 +
          Math.pow(Math.sin(u * 22.5 - seed * 0.6) * 0.5 + 0.5, 3) * 0.24;
        const erosion = Math.sin(u * 88 + v * 24 + seed) * Math.sin(u * 23 - v * 19) * 0.075;
        const y = Math.pow(cross, 1.45) * height * Math.max(0.1, peaks + erosion);
        vertices.push((u - 0.5) * length, y - 3, (v - 0.5) * depth);
        uv.push(u * length * 0.025, v * depth * 0.025);
        const bare =
          Math.max(0, Math.min(0.6, (Math.sin(u * 76 + v * 8 + seed) + 0.5) * 0.36)) * cross;
        const shade = 0.94 - bare * 0.32 + v * 0.04;
        colors.push(shade * 0.92, shade * 0.98, shade);
        if (z < nz && x < nx) {
          const a = z * (nx + 1) + x,
            b = a + nx + 1;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }
  // These continuous strips form several authored, irregular mountain chains.
  // The road-side climb stays unobstructed and the world never uses giant cones.
  const placements = [
    [-160, -520, 0, 320, 145, 180, 1],
    [140, -525, 0.1, 320, 150, 155, 3],
    [470, -165, Math.PI / 2, 350, 160, 210, 5],
    [485, 160, Math.PI / 2, 340, 160, 170, 8],
    [-475, -160, Math.PI / 2, 320, 130, 135, 13],
    [-485, 155, Math.PI / 2, 320, 150, 150, 17],
    [-140, 495, 0, 320, 145, 155, 11],
    [150, 490, 0, 310, 130, 135, 19],
    [-40, -685, 0, 720, 170, 230, 23],
    [680, 15, Math.PI / 2, 700, 180, 265, 27],
    [-80, 650, 0, 720, 180, 210, 31],
    [-660, 10, Math.PI / 2, 700, 165, 205, 37],
  ];
  for (const [x, z, rotation, length, depth, height, seed] of placements) {
    const group = new THREE.Group();
    group.name = "Layered sculpted alpine ridge";
    group.position.set(x, -1.6, z);
    group.rotation.y = rotation;
    scenery.add(group);
    const ridge = kit.mesh(ridgeGeometry(seed, length, depth, height), stone, group);
    ridge.castShadow = false;
    ridge.receiveShadow = false;
  }
}
