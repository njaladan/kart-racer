/** A small fleet of large rigid assemblies keeps Port Lumen working all night. */
export function buildLumenMotion({ THREE, scenery, track, kit, materials, props, animated }) {
  const { box, mesh, groupAt, sectorT, batch } = kit;
  const { steel, concrete, dark, cyan, pink, amber, window, cargo, sign } = materials;
  const { fitAsset } = props;
  const axis = new THREE.Vector3(0, 1, 0);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
  const movers = [];

  // Elevated transit crosses the downtown canyon. Its ends disappear into
  // substantial station blocks rather than visibly teleporting in the sky.
  const stationT = sectorT(1, 0.54);
  const viaduct = groupAt(stationT);
  viaduct.rotation.set(0, track.yawFor(track.frameAt(stationT).tangent), 0);
  box(steel, viaduct, [0, 19, 0], [172, 1.4, 6]);
  for (const x of [-74, -43, 43, 74]) {
    box(concrete, viaduct, [x, 8.6, 0], [2.5, 18, 3]);
    box(dark, viaduct, [x, 20.6, 0], [20, 3.2, 7.8]);
    box(cyan, viaduct, [x, 22.4, 0], [20, 0.15, 8]);
  }
  for (const z of [-2.4, 2.4]) box(cyan, viaduct, [0, 19.83, z], [170, 0.07, 0.08]);
  for (const x of [-50, 50]) sign(viaduct, 7, [x, 18.9, 3.05], 18, 2.4);
  const train = new THREE.Group();
  viaduct.add(train);
  for (let car = 0; car < 3; car++) {
    const x = (car - 1) * 12.8;
    box(steel, train, [x, 21.45, 0], [12.3, 2.8, 3.3]);
    box(dark, train, [x, 22.96, 0], [12.3, 0.3, 3.5]);
    for (const side of [-1, 1]) {
      box(pink, train, [x, 20.5, side * 1.68], [11.5, 0.17, 0.07]);
      for (let windowIndex = 0; windowIndex < 6; windowIndex++) {
        box(window, train, [x - 4.8 + windowIndex * 1.9, 21.8, side * 1.68], [1.5, 1.1, 0.07]);
        box(dark, train, [x - 4.8 + windowIndex * 1.9, 22.2, side * 1.73], [1.48, 0.15, 0.05]);
      }
    }
    for (const z of [-1.3, 1.3]) box(cyan, train, [x + 6.18, 21.1, z], [0.06, 0.3, 0.45]);
  }
  batch(train);
  animated.push(train);
  movers.push((time) => {
    const travel = ((time * 10) % 224) - 112;
    train.position.x = travel;
    train.visible = Math.abs(travel) < 92;
  });

  // A second scenic expressway creates another readable layer beyond the
  // market. Small vehicles move there independently of bridge race traffic.
  const express = groupAt(sectorT(2, 0.52), -49);
  express.rotation.set(0, track.yawFor(track.frameAt(sectorT(2, 0.52)).tangent), 0);
  box(concrete, express, [0, 22, 0], [8, 1, 170]);
  for (const x of [-4, 4]) box(cyan, express, [x, 22.85, 0], [0.15, 0.3, 170]);
  for (const z of [-74, -37, 0, 37, 74]) box(concrete, express, [0, 10.5, z], [2.3, 22, 2.3]);
  for (let i = 0; i < 4; i++) {
    const car = new THREE.Group();
    express.add(car);
    fitAsset(`lumen:${i % 2 ? "van" : "sedan"}`, car, [0, 0, 0], [2.1, 1.7, 4.7]);
    for (const x of [-0.8, 0.8]) box(window, car, [x, 0.6, -2.35], [0.3, 0.18, 0.05]);
    batch(car);
    animated.push(car);
    movers.push((time) => {
      car.position.set(i % 2 ? 1.9 : -1.9, 22.55, ((time * 11 + i * 49) % 188) - 94);
      car.rotation.y = i % 2 ? 0 : Math.PI;
      car.visible = Math.abs(car.position.z) < 78;
    });
  }

  // Empty enclosed water taxis run alongside both opening and return quays.
  for (const district of [0, 6]) {
    const boat = new THREE.Group();
    scenery.add(boat);
    box(dark, boat, [0, 0.25, 0], [4.5, 0.7, 10.5]);
    box(steel, boat, [0, 0.85, 0], [4.1, 0.7, 9.4]);
    box(dark, boat, [0, 1.8, -0.4], [3.7, 1.6, 5.8]);
    box(amber, boat, [0, 2.65, -0.4], [4.1, 0.16, 6.2]);
    for (const side of [-1, 1]) {
      for (const z of [-2, 0, 2]) box(window, boat, [side * 1.88, 1.85, z], [0.04, 0.85, 1.4]);
      box(side < 0 ? pink : cyan, boat, [side * 1.95, 2.8, -0.3], [0.2, 0.12, 0.2]);
      const wake = box(cyan, boat, [side * 2.3, -0.04, 8], [0.14, 0.035, 8]);
      wake.rotation.y = side * -0.18;
    }
    sign(boat, 11, [0, 1.6, 3], 3, 0.75);
    batch(boat);
    animated.push(boat);
    movers.push((time) => {
      const phase = (time * 0.015 + district * 0.09) % 2;
      const fraction = phase < 1 ? 0.05 + phase * 0.9 : 0.95 - (phase - 1) * 0.9;
      const t = sectorT(district, fraction);
      const pose = track.poseAt(t * track.TRACK, 30, 0);
      kit.align(boat, pose);
      boat.rotation.set(0, track.yawFor(pose.tangent) + (phase > 1 ? Math.PI : 0), 0);
      boat.position.y = -1.43 + Math.sin(time * 0.8 + district) * 0.08;
    });
  }

  // Rail-mounted gantry cranes lift shipping containers above the working quay.
  for (let i = 0; i < 3; i++) {
    const crane = groupAt(sectorT(4, 0.12 + i * 0.33), 37);
    crane.rotation.set(0, track.yawFor(track.frameAt(sectorT(4, 0.12 + i * 0.33)).tangent), 0);
    for (const x of [-11, 11]) {
      box(steel, crane, [x, 15.5, 0], [1.3, 31, 1.3]);
      box(amber, crane, [x, 5, 0], [1.55, 0.8, 1.55]);
      for (const z of [-3.8, 3.8]) {
        box(steel, crane, [x, 0.6, z], [2.8, 1.2, 2]);
        mesh(cylinder, dark, crane, [x, 0.4, z], [0.55, 0.9, 0.55]).rotation.z = Math.PI / 2;
      }
      const brace = box(steel, crane, [x * 0.7, 26, 0], [0.4, 11, 0.4]);
      brace.rotation.z = Math.sign(x) * -0.58;
    }
    box(amber, crane, [0, 31.3, 0], [32, 1.3, 2.5]);
    sign(crane, 9, [0, 31.2, 1.3], 11, 2.4);
    const trolley = new THREE.Group();
    crane.add(trolley);
    box(dark, trolley, [0, 30.2, 0], [3, 0.7, 3]);
    const hook = new THREE.Group();
    trolley.add(hook);
    for (const x of [-1.5, 1.5]) box(steel, hook, [x, 21, 0], [0.07, 18, 0.07]);
    box(amber, hook, [0, 12, 0], [4.6, 0.6, 2.8]);
    box(cargo[i % 5], hook, [0, 10, 0], [5.4, 3.2, 8]);
    batch(hook);
    animated.push(trolley);
    movers.push((time) => {
      const phase = time * 0.18 + i * 2;
      trolley.position.x = Math.sin(phase) * 7;
      const lift = (Math.sin(phase + 0.8) + 1) * 3;
      hook.position.y = lift;
      hook.scale.y = 1 - lift / 31;
    });
  }

  // An enormous turbine district is visible above the container walls; only
  // three rotating fan assemblies are needed for the whole cooling plant.
  const plant = groupAt(sectorT(4, 0.64), -65);
  box(steel, plant, [0, 15, 0], [30, 30, 25]);
  box(dark, plant, [0, 30.5, 0], [32, 1, 27]);
  sign(plant, 2, [0, 18, 12.6], 24, 8);
  for (const x of [-10, 0, 10]) {
    const fan = new THREE.Group();
    plant.add(fan);
    fan.position.set(x, 32, 0);
    mesh(cylinder, dark, plant, [x, 30.9, 0], [4.3, 1, 4.3]);
    for (let blade = 0; blade < 3; blade++) {
      const rotor = new THREE.Group();
      fan.add(rotor);
      rotor.rotation.y = (blade * Math.PI * 2) / 3;
      box(steel, rotor, [1.8, 0, 0], [3.6, 0.2, 1.1]);
    }
    batch(fan);
    animated.push(fan);
    movers.push((time) => fan.quaternion.setFromAxisAngle(axis, time * 1.1));
  }
  return {
    update(time) {
      for (const move of movers) move(time);
    },
  };
}
