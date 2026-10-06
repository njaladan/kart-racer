/** The road-service vehicle has a matching footprint and a visible warning. */
export function buildGroomer({ THREE, scene, track, festival, hazardAt }) {
  const { palette: p, geometry, box, mesh, batch, align, groupAt, edgeOffset } = festival;
  const groomer = new THREE.Group();
  scene.add(groomer);
  box(p.red, groomer, [0, 0.9, 0], [2.3, 1.05, 3.4]);
  for (const x of [-0.98, 0.98]) {
    box(p.dark, groomer, [x, 0.35, 0], [0.5, 0.6, 3.8]);
    for (let z = -1.55; z <= 1.6; z += 0.45) box(p.rock, groomer, [x, 0.26, z], [0.51, 0.12, 0.15]);
  }
  box(p.red, groomer, [0, 1.8, 0.35], [1.65, 1.05, 1.9]);
  box(p.glass, groomer, [0, 1.9, -0.62], [1.4, 0.7, 0.08]);
  for (const x of [-0.83, 0.83]) box(p.glass, groomer, [x, 1.9, 0.35], [0.05, 0.7, 1.5]);
  box(p.rock, groomer, [0, 0.42, -1.98], [2.66, 0.55, 0.3]);
  mesh(geometry.cylinder, p.gold, groomer, [0, 2.44, 0.4], [0.21, 0.25, 0.21]);
  batch(groomer);
  const warning = groupAt(track.CART_T, edgeOffset(track.CART_T, 1, 3));
  box(p.dark, warning, [0, 2, 0], [0.2, 4, 0.2]);
  const beacon = mesh(geometry.sphere, p.gold, warning, [0, 4.2, 0], [0.5, 0.5, 0.5]);
  groomer.userData.skipBake = true;
  beacon.userData.skipBake = true;
  return {
    animated: [groomer, beacon],
    update(time) {
      const state = hazardAt(time);
      align(groomer, state);
      beacon.visible = state.warning ? Math.floor(time * 6) % 2 === 0 : state.active;
    },
  };
}
