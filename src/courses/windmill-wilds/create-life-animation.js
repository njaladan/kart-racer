/** Assemble bounded wildlife particles and animate fabric, crowds, boats, and machinery. */
export function createLifeAnimation({
  THREE,
  animate,
  animated,
  arms,
  birds,
  boats,
  butterflies,
  flags,
  gear,
  kit,
  random,
  roadside,
  scene,
  track,
  wheel,
  palette,
  geometry,
}) {
  const { mesh, sectorT } = kit;
  const { blossom, butter } = palette;
  const { sphere } = geometry;
  // Thin colored wings remain recognizable from chase height without alpha cards.
  for (let i = 0; i < 10; i++) {
    const section = i < 6 ? 0 : 5,
      g = animate(roadside(section, 0.12 + random() * 0.7, i % 2 ? 1 : -1, 6, 1, scene));
    if (!g) continue;
    g.position.y += 2.4;
    g.name = "Meadow butterfly";
    const wings = [];
    for (const side of [-1, 1]) {
      const w = new THREE.Group();
      g.add(w);
      mesh(sphere, i % 2 ? butter : blossom, w, [side * 0.22, 0, 0], [0.28, 0.035, 0.32]);
      wings.push(w);
    }
    butterflies.push({
      g,
      wings,
      x: g.position.x,
      y: g.position.y,
      z: g.position.z,
      phase: i * 1.7,
    });
  }
  function driftingParticles(section, count, color, size, name) {
    const positions = new Float32Array(count * 3),
      origins = new Float32Array(count * 3),
      phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const f = 0.1 + random() * 0.8,
        t = sectorT(section, f),
        side = i % 2 ? 1 : -1,
        s = track.surfaceAt(t);
      const edge = side > 0 ? s.rightEdge : -s.leftEdge;
      const frame = track.poseAt(t * track.TRACK, side * (edge + 3 + random() * 10), 0);
      positions[i * 3] = frame.p.x;
      positions[i * 3 + 1] = frame.p.y + 1 + random() * 5;
      positions[i * 3 + 2] = frame.p.z;
      phase[i] = random() * 6;
    }
    origins.set(positions);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const m = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color,
        size,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    m.name = name;
    scene.add(m);
    animate(m);
    geo.computeBoundingSphere();
    return { geo, positions, origins, phase, count };
  }
  const motes = driftingParticles(1, 60, "#bce6bb", 0.12, "Pine hollow drifting motes");
  const petals = driftingParticles(5, 80, "#ffcabd", 0.19, "Orchard drifting blossom");
  // Crowd arms share a few moving batches, rather than one draw per limb.
  const cheering = new THREE.Group();
  scene.add(cheering);
  for (const arm of arms) arm.g.rotation.z = arm.side * 1.9;
  scene.updateMatrixWorld(true);
  for (const arm of arms) {
    for (const limb of [...arm.g.children]) {
      limb.matrixWorld.decompose(limb.position, limb.quaternion, limb.scale);
      cheering.add(limb);
    }
    animated.splice(animated.indexOf(arm.g), 1);
    arm.g.removeFromParent();
  }
  kit.batch(cheering);
  animated.push(cheering);
  const cheerMotion = cheering.children.map((m) => ({
    mesh: m,
    base: m.geometry.attributes.position.array.slice(),
  }));
  // Merge each moving assembly while preserving its animated transform.
  for (const b of boats) kit.batch(b.g);
  if (wheel) kit.batch(wheel);
  if (gear) kit.batch(gear);
  return {
    animated,
    update(time) {
      for (const f of flags) {
        const a = f.geo.attributes.position.array;
        for (let i = 0; i < a.length; i += 3) {
          const x = f.rest[i];
          a[i + 2] = Math.sin(time * 3 + f.phase - x * 2.6) * 0.21 * (x / f.length);
          a[i + 1] = f.rest[i + 1] + Math.sin(time * 2 + f.phase - x) * 0.04 * (x / f.length);
        }
        f.geo.attributes.position.needsUpdate = true;
      }
      for (const { mesh: m, base } of cheerMotion) {
        const p = m.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const j = i * 3,
            wave = Math.sin(time * 4 + base[j] * 0.35 + base[j + 2] * 0.8);
          p.array[j + 1] = base[j + 1] + wave * 0.14;
          p.array[j + 2] = base[j + 2] + wave * 0.09;
        }
        p.needsUpdate = true;
      }
      for (const b of boats) {
        b.g.position.y = b.baseY + Math.sin(time * 1.1 + b.phase) * 0.14;
        b.g.rotation.z = Math.sin(time * 0.7 + b.phase) * 0.035;
        b.g.rotation.y = b.baseR + Math.sin(time * 0.3 + b.phase) * 0.09;
      }
      for (const b of butterflies) {
        b.g.position.set(
          b.x + Math.sin(time * 0.55 + b.phase) * 1.8,
          b.y + Math.sin(time * 0.9 + b.phase) * 0.5,
          b.z + Math.cos(time * 0.65 + b.phase) * 1.6,
        );
        b.g.rotation.y = time * 0.4 + b.phase;
        b.wings[0].rotation.z = Math.sin(time * 18 + b.phase) * 0.7;
        b.wings[1].rotation.z = -b.wings[0].rotation.z;
      }
      for (const b of birds) {
        b.g.position.x = b.x + Math.cos(time * 0.16 + b.phase) * 13;
        b.g.position.z = b.z + Math.sin(time * 0.16 + b.phase) * 13;
        b.g.rotation.y = -time * 0.16 - b.phase;
        b.wings[0].rotation.z = Math.sin(time * 3 + b.phase) * 0.25;
        b.wings[1].rotation.z = -b.wings[0].rotation.z;
      }
      if (wheel) wheel.rotation.x = time * 0.42;
      if (gear) gear.rotation.x = -time * 1.17;
      for (const p of [motes, petals]) {
        for (let i = 0; i < p.count; i++) {
          const j = i * 3;
          p.positions[j] = p.origins[j] + Math.sin(time * 0.3 + p.phase[i]) * 1.5;
          p.positions[j + 1] = p.origins[j + 1] + Math.sin(time * 0.5 + p.phase[i]) * 0.7;
          p.positions[j + 2] = p.origins[j + 2] + Math.cos(time * 0.24 + p.phase[i]) * 1.4;
        }
        p.geo.attributes.position.needsUpdate = true;
      }
    },
  };
}
