import { emberwingWater } from "./emberwing-water.js";

/** A calm, working fishing harbor with boats, gear and wind-driven motion. */
export function buildEmberwingHarbor(w, art) {
  const { THREE, at, mesh, box, cylinder, sphere, tube, motion } = w;
  const { wood, blue, plaster, coral, cream } = art;
  emberwingWater(w);
  const netMaterial = new THREE.MeshBasicMaterial({
    color: "#d5c9a6",
    wireframe: true,
    transparent: true,
    opacity: 0.65,
  });
  for (let i = 0; i < 6; i++) {
    const f = (i + 0.5) / 6;
    const dock = at(6, f, 20);
    dock.position.y = -9.4;
    dock.name = "Harbor wooden fishing pier";
    box(wood, dock, [0, 0, 0], [5, 0.5, 20]);
    for (const x of [-2, 2])
      for (const z of [-8, 0, 8]) mesh(cylinder, wood, dock, [x, -4, z], [0.28, 8, 0.28]);
    for (let board = 0; board < 14; board++)
      box(cream, dock, [0, 0.28, -9 + board * 1.4], [4.7, 0.07, 0.065]);
    for (let crate = 0; crate < 3; crate++)
      box(wood, dock, [crate % 2 ? 1 : -1, 0.8, crate * 2 - 5], [1.4, 1.3, 1.4]);
    for (let coil = 0; coil < 3; coil++)
      mesh(w.torus, cream, dock, [1.2, 0.35 + coil * 0.08, 3], [0.8, 0.8, 0.8]).rotation.x =
        Math.PI / 2;
    const net = mesh(new THREE.PlaneGeometry(4, 5, 8, 8), netMaterial, dock, [0, 4, -7]);
    net.name = "Slowly hoisted harbor fishing net";
    tube(dock, [-2, 0, -7], [-2, 8, -7], 0.17, wood);
    tube(dock, [-2, 8, -7], [2, 8, -7], 0.17, wood);
    motion(net, (time, state) => {
      net.position.y = 4 + (state?.motionEnabled === false ? 0 : Math.sin(time * 0.24 + i) * 0.8);
    });
    const boatSite = at(6, f, 28 + (i % 2) * 5);
    boatSite.position.y = -9.8;
    const boat = new THREE.Group();
    boatSite.add(boat);
    boat.name = "Bobbing blue-and-white fishing boat";
    mesh(
      new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      i % 2 ? blue : coral,
      boat,
      [0, 0, 0],
      [3, 2.2, 7],
    );
    box(plaster, boat, [0, 0, 0], [4.5, 0.25, 10]);
    box(blue, boat, [0, 1.6, 1], [2.8, 3, 3]);
    box(plaster, boat, [0, 3.15, 1], [3.4, 0.3, 3.5]);
    box(cream, boat, [0, 1.8, 2.55], [1.6, 1, 0.12]);
    tube(boat, [0, 0, -2], [0, 10, -2], 0.12, wood);
    const flag = mesh(new THREE.PlaneGeometry(2.4, 1.5), i % 2 ? coral : blue, boat, [1.2, 9, -2]);
    flag.material = flag.material.clone();
    flag.material.side = THREE.DoubleSide;
    for (let buoy = 0; buoy < 3; buoy++)
      mesh(sphere, buoy % 2 ? coral : plaster, boat, [2.5, 0.8, -3 + buoy * 2], [0.35, 0.5, 0.35]);
    motion(boat, (time, state) => {
      const seconds = state?.motionEnabled === false ? 0 : time;
      boat.position.y = Math.sin(seconds * 0.7 + i) * 0.28;
      boat.rotation.z = Math.sin(seconds * 0.55 + i) * 0.035;
      boat.rotation.x = Math.sin(seconds * 0.4 + i) * 0.025;
      flag.rotation.y = Math.sin(seconds * 1.4 + i) * 0.22;
    });
  }
  // Quayside stairs connect the town's waterfront to the lower piers.
  for (const f of [0.15, 0.5, 0.84]) {
    const g = at(6, f, 13);
    const rise = g.position.y + 9.2;
    for (let step = 0; step < 12; step++)
      box(cream, g, [step * 1.3, (-rise * (step + 0.5)) / 12, 0], [1.3, rise / 12, 4]);
    for (let i = 0; i < 3; i++) {
      box(wood, g, [-1, 0.7, -5 - i * 2], [1.4, 1.4, 1.4]);
      mesh(w.torus, cream, g, [-1, 1.45, -5 - i * 2], [0.5, 0.5, 0.5]).rotation.x = Math.PI / 2;
    }
  }
}
