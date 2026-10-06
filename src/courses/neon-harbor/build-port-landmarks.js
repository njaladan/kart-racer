/** Large, readable Port Lumen landmarks built around the shared road frames. */
export function buildPortLandmarks({
  THREE,
  scenery,
  kit,
  palette,
  track,
  trafficAt,
  animated,
  geometry,
}) {
  const { material, mesh, box, groupAt, sectorT, batch } = kit;
  const { steel, concrete, dark, cyan, pink, amber, glass } = palette;

  // Neon welcome gantry at the promenade-to-downtown transition.
  const welcome = groupAt(sectorT(0, 0.93), 0, scenery);
  for (const x of [-16, 16]) {
    box(steel, welcome, [x, 7.8, 0], [0.75, 15.6, 0.9]);
    box(cyan, welcome, [x, 15.5, 0.48], [0.18, 13.8, 0.08]);
  }
  box(steel, welcome, [0, 16.2, 0], [33, 1.1, 1.2]);
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#101a31";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#e74da8";
  ctx.lineWidth = 9;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 50px sans-serif";
  ctx.fillStyle = "#ffe2b5";
  ctx.fillText("WELCOME TO", 512, 73);
  ctx.font = "900 108px sans-serif";
  ctx.shadowColor = "#42f5f1";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#70fff4";
  ctx.fillText("PORT LUMEN", 512, 174);
  const welcomeMap = new THREE.CanvasTexture(canvas);
  welcomeMap.colorSpace = THREE.SRGBColorSpace;
  const signMat = material("#ffffff", {
    map: welcomeMap,
    emissive: "#4ecdc9",
    emissiveMap: welcomeMap,
    emissiveIntensity: 1.1,
    side: THREE.DoubleSide,
    roughness: 0.68,
  });
  const sign = mesh(new THREE.PlaneGeometry(29, 5.2), signMat, welcome, [0, 16.15, 0.66]);
  sign.castShadow = false;
  box(amber, welcome, [0, 13.25, 0.42], [24, 0.1, 0.12]);
  batch(welcome);

  // Lumen Tower's lit crown is visible above the paired downtown blocks.
  const tower = groupAt(sectorT(1, 0.78), 36, scenery),
    towerGlass = material("#314a62", { roughness: 0.3, metalness: 0.34, emissive: "#15334a", emissiveIntensity: 0.5 });
  box(steel, tower, [0, 37, 0], [19, 74, 22]);
  for (let y = 8; y < 70; y += 8) {
    box(towerGlass, tower, [0, y, 11.08], [15.5, 3.7, 0.12]);
    box(cyan, tower, [0, y + 2, 11.16], [16.2, 0.16, 0.16]);
  }
  box(dark, tower, [0, 73.5, 0], [21, 1.2, 24]);
  box(pink, tower, [0, 75.4, 0], [14, 2.4, 17]);
  box(cyan, tower, [0, 77.2, 0], [8, 1.1, 11]);
  batch(tower);

  // Suspension towers and cable lines follow the bridge's actual constructed
  // frames, so the silhouette remains attached when route authoring changes.
  const towerStations = [0.2, 0.76];
  for (const fraction of towerStations) {
    const t = sectorT(3, fraction),
      tower = groupAt(t, 0, scenery);
    for (const x of [-15, 15]) {
      box(concrete, tower, [x, 18, 0], [2.8, 38, 3]);
      box(cyan, tower, [x, 20, 1.56], [0.18, 34, 0.08]);
      box(pink, tower, [x, 35.5, 0], [3.2, 0.3, 3.4]);
    }
    box(steel, tower, [0, 32, 0], [31, 1.2, 2.1]);
    box(amber, tower, [0, 2.5, 0], [32, 0.35, 2.6]);
    batch(tower);
  }
  const cableMaterial = material("#4fced2", { emissive: "#168f9d", emissiveIntensity: 0.85 });
  const beam = (a, b, radius, mat) => {
    const delta = new THREE.Vector3().subVectors(b, a),
      length = delta.length(),
      object = new THREE.Mesh(geometry.cylinder, mat);
    object.position.copy(a).add(b).multiplyScalar(0.5);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    object.scale.set(radius, length, radius);
    object.castShadow = false;
    scenery.add(object);
    return object;
  };
  for (const side of [-1, 1]) {
    const points = [];
    for (let i = 0; i <= 24; i++) {
      const f = 0.1 + (0.8 * i) / 24,
        arch = Math.sin((i / 24) * Math.PI),
        pose = track.poseAt(sectorT(3, f) * track.TRACK, side * 15, 31 + arch * 8);
      points.push(pose.p);
    }
    for (let i = 0; i < points.length - 1; i++) beam(points[i], points[i + 1], 0.28, cableMaterial);
    for (let i = 2; i < 24; i += 2) {
      const t = sectorT(3, 0.1 + (0.8 * i) / 24),
        arch = Math.sin((i / 24) * Math.PI),
        top = track.poseAt(t * track.TRACK, side * 15, 31 + arch * 8).p,
        foot = track.poseAt(t * track.TRACK, side * 15, 3).p;
      beam(foot, top, 0.075, steel);
    }
  }

  // Fixed hollow vehicle-ferry shell. The existing course road remains the
  // deck; walls and roof sit outside it and leave an unobstructed central bay.
  for (let i = 0; i <= 10; i++) {
    const fraction = 0.2 + i * 0.06,
      t = sectorT(5, fraction),
      frame = groupAt(t, 0, scenery),
      isPortal = i === 0 || i === 10;
    for (const side of [-1, 1]) {
      box(concrete, frame, [side * 12, 4.4, 0], [1.1, 8.8, 8]);
      box(steel, frame, [side * 13.7, 0.45, 0], [1.1, 2.1, 8.2]);
      box(cyan, frame, [side * 11.35, 7.5, 0], [0.12, 0.18, 7.8]);
      if (isPortal) {
        box(steel, frame, [side * 12, 9, 0], [1.2, 18, 1.5]);
        box(pink, frame, [side * 12, 17.5, 0.78], [2.3, 0.22, 0.12]);
      }
    }
    box(steel, frame, [0, 14.2, 0], [25, 1.4, 8]);
    box(dark, frame, [0, 13.45, 0], [19.5, 0.12, 7.6]);
    for (const x of [-8, -4, 4, 8]) box(amber, frame, [x, 13.32, 0], [0.12, 0.08, 7.2]);
    if (i === 5) {
      // Dark side recesses and luminous port holes establish a vessel interior.
      for (const side of [-1, 1]) {
        box(dark, frame, [side * 11.42, 5.2, 0], [0.1, 2.1, 4.6]);
        for (const z of [-1.4, 1.4]) {
          const porthole = mesh(
            new THREE.CircleGeometry(0.42, 12),
            glass,
            frame,
            [side * 11.32, 10.3, z],
            [1, 1, 1],
          );
          porthole.rotation.y = side * (Math.PI / 2);
        }
      }
    }
    batch(frame);
  }

  // A slowly turning lighthouse beam anchors the south seawall in the harbor.
  const lighthouse = groupAt(sectorT(6, 0.66), 34, scenery),
    lighthouseBody = mesh(geometry.cylinder, concrete, lighthouse, [0, 10, 0], [3.2, 20, 3.2]),
    lantern = mesh(geometry.cylinder, amber, lighthouse, [0, 21, 0], [3.5, 2.2, 3.5]),
    lighthouseBeam = new THREE.Group();
  lighthouseBody.castShadow = lantern.castShadow = false;
  box(dark, lighthouse, [0, 22.4, 0], [4.6, 0.45, 4.6]);
  box(cyan, lighthouse, [0, 23.2, 0], [0.3, 1.2, 0.3]);
  const beamMaterial = material("#67e7e5", {
    emissive: "#3cbabf",
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.23,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beam = mesh(new THREE.PlaneGeometry(38, 4), beamMaterial, lighthouseBeam, [19, 22, 0]);
  beam.rotation.y = Math.PI / 2;
  beam.castShadow = false;
  lighthouse.add(lighthouseBeam);
  animated.push(lighthouseBeam);

  // Bridge traffic reuses the simulation's exact poses. These simple opaque
  // vehicles are scenery only; contact remains in the shared hazard system.
  const trafficMaterial = [
    material("#bd5e66", { roughness: 0.55, metalness: 0.16 }),
    material("#4f9ea7", { roughness: 0.55, metalness: 0.16 }),
    material("#d3a15d", { roughness: 0.55, metalness: 0.16 }),
    material("#526a8d", { roughness: 0.55, metalness: 0.16 }),
  ];
  const trafficModels = (trafficAt?.(0) || []).map((pose, index) => {
    const vehicle = new THREE.Group(),
      isLong = pose.kind === "van" || pose.kind === "truck",
      width = pose.halfWidth * 2,
      length = pose.halfLength * 2,
      bodyY = isLong ? 0.85 : 0.72;
    box(trafficMaterial[index % trafficMaterial.length], vehicle, [0, bodyY, 0], [width, 0.9, length]);
    box(dark, vehicle, [0, bodyY + 0.55, -0.2], [width * 0.78, 0.58, length * 0.4]);
    for (const side of [-1, 1]) {
      box(amber, vehicle, [side * width * 0.38, 0.68, -length * 0.47], [0.22, 0.16, 0.08]);
      box(pink, vehicle, [side * width * 0.38, 0.68, length * 0.47], [0.22, 0.16, 0.08]);
      for (const z of [-length * 0.3, length * 0.3]) {
        const wheel = mesh(geometry.cylinder, dark, vehicle, [side * width * 0.49, 0.34, z], [0.38, 0.34, 0.38]);
        wheel.rotation.z = Math.PI / 2;
      }
    }
    scenery.add(vehicle);
    animated.push(vehicle);
    return vehicle;
  });

  // A separate cargo ship crosses under the bridge once on the player's
  // second lap. Its hull has no gameplay contact and is hidden on other laps.
  const ship = new THREE.Group();
  box(steel, ship, [0, 0, 0], [14, 3.2, 58]);
  box(dark, ship, [0, 1.7, 0], [11.5, 0.35, 52]);
  box(concrete, ship, [0, 3.2, -17], [8, 4.1, 8]);
  box(glass, ship, [0, 5.2, -17], [6.8, 1.4, 0.12]);
  for (let row = 0; row < 4; row++)
    for (let i = 0; i < 4; i++) {
      const containerMat = i % 2 ? steel : pink;
      box(containerMat, ship, [-4.2 + i * 2.8, 3.4 + row * 2.6, 3 + (i % 2) * 8], [2.6, 2.4, 7.3]);
      box(i % 2 ? cyan : amber, ship, [-4.2 + i * 2.8, 4.6 + row * 2.6, 6.7 + (i % 2) * 8], [2.1, 0.08, 0.08]);
    }
  box(amber, ship, [0, 16.2, -17], [0.22, 5, 0.22]);
  box(cyan, ship, [0, 18.6, -17], [2.4, 0.1, 0.1]);
  ship.visible = false;
  scenery.add(ship);
  animated.push(ship);
  const bridgeFrame = track.frameAt(sectorT(3, 0.48)),
    shipTravel = new THREE.Vector3(bridgeFrame.right.x, 0, bridgeFrame.right.z).normalize(),
    shipCenter = bridgeFrame.p.clone();
  shipCenter.y = -0.65;
  const shipStart = shipCenter.clone().addScaledVector(shipTravel, -55),
    shipEnd = shipCenter.clone().addScaledVector(shipTravel, 55),
    shipQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), shipTravel);
  const bridgeEntryT = sectorT(3, 0.05);
  let shipStarted = false,
    shipCompleted = false,
    shipStartTime = 0,
    previousTime = 0;

  return {
    update(time, state = {}) {
      lighthouseBeam.rotation.y = time * (Math.PI * 2 / 30);
      const poses = trafficAt?.(time) || [];
      for (let i = 0; i < trafficModels.length; i++) {
        const vehicle = trafficModels[i],
          pose = poses[i];
        vehicle.visible = !!pose?.active;
        if (pose?.active) kit.align(vehicle, pose);
      }

      if (time < previousTime) {
        shipStarted = false;
        shipCompleted = false;
        shipStartTime = 0;
        ship.visible = false;
      }
      previousTime = time;
      if (state.playerLap !== 1) {
        ship.visible = false;
        return;
      }
      if (!shipStarted && state.running && state.playerT >= bridgeEntryT) {
        shipStarted = true;
        shipStartTime = time;
      }
      if (!shipStarted || shipCompleted) {
        ship.visible = false;
        return;
      }
      const age = Math.max(0, time - shipStartTime),
        duration = 20,
        progress = age / duration;
      if (progress >= 1) {
        shipCompleted = true;
        ship.visible = false;
        return;
      }
      ship.position.copy(shipStart).lerp(shipEnd, progress);
      ship.quaternion.copy(shipQuaternion);
      ship.visible = true;
    },
  };
}
