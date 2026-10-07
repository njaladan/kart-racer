import { trainCarriages } from "../../simulation/moving-surfaces.js";
import { trainRampHeight } from "../../simulation/experience-mechanics.js";
import { metalDeckDetail } from "./architectural-detail.js";

/** Colored freight roofs and launch faces share the simulation's moving coordinates. */
export function buildExpressCars(w, materials) {
  const { THREE, scenery, track, kit, mat, box, mesh, cylinder, tube, motion } = w;
  const { iron, cream, wood, dark, silver, glow } = materials;
  const definition = track.course.movingDecks[0];
  const cars = trainCarriages(track, definition, 0);
  const ramp = track.course.trainRamps;
  const pipeGeometry = kit.authoredGeometry("blender:freight-pipe", cylinder);
  const roofs = definition.carStyles.map((style) => {
    const material = mat(style.color, "metal", {
      metalness: 0.32,
      roughness: 0.65,
      vertexColors: true,
      emissive: style.color,
      emissiveIntensity: 0.08,
    });
    metalDeckDetail(material);
    return material;
  });
  const warning = mat("#ffd657", "metal", { vertexColors: true, roughness: 0.65 });
  let posesTime = NaN;
  let poses;
  const carriageAt = (time, index) => {
    if (posesTime !== time) {
      posesTime = time;
      poses = trainCarriages(track, definition, time);
    }
    return poses[index];
  };

  function ribbon(rows, columns, material, name) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array((rows + 1) * (columns + 1) * 3);
    const colors = new Float32Array(positions.length);
    const uv = [];
    const indices = [];
    for (let row = 0; row <= rows; row++) {
      for (let col = 0; col <= columns; col++) {
        uv.push((col / columns - 0.5) * 2, row * 0.16);
        if (row < rows && col < columns) {
          const q = row * (columns + 1) + col;
          indices.push(q, q + 1, q + columns + 1, q + 1, q + columns + 2, q + columns + 1);
        }
      }
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    const object = new THREE.Mesh(geometry, material);
    object.name = name;
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = false;
    scenery.add(object);
    motion(object, () => {});
    const white = new THREE.Color("#ffffff");
    const charcoal = new THREE.Color("#263340");
    return {
      object,
      update(poseFor, stripeFor) {
        for (let row = 0; row <= rows; row++) {
          for (let col = 0; col <= columns; col++) {
            const q = (row * (columns + 1) + col) * 3;
            const p = poseFor(row / rows, col / columns);
            positions.set([p.x, p.y, p.z], q);
            const color = stripeFor(row, col) ? charcoal : white;
            colors.set([color.r, color.g, color.b], q);
          }
        }
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
        geometry.computeVertexNormals();
      },
    };
  }

  return cars.map((car) => {
    const style = car.style;
    const paint = mat(style.color, "metal", {
      roughness: 0.75,
      metalness: 0.12,
      side: THREE.DoubleSide,
      emissive: style.color,
      emissiveIntensity: 0.08,
    });
    const g = new THREE.Group();
    g.name = `Express car ${car.index + 1}: ${style.name}`;
    scenery.add(g);
    const wheels = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 12; i++)
        box(iron, g, [side * 9.1, -1.9, ((i - 5.5) * car.length) / 12], [0.15, 2.4, 0.16]);
      for (const z of [-car.length * 0.33, car.length * 0.33]) {
        const wheel = new THREE.Group();
        g.add(wheel);
        wheel.position.set(side * 7.7, -3.3, z);
        wheel.rotation.z = Math.PI / 2;
        mesh(cylinder, dark, wheel, [0, 0, 0], [1.5, 1.2, 1.5]);
        for (let i = 0; i < 3; i++)
          box(silver, wheel, [0, 0.62, 0], [2.4, 0.08, 0.15]).rotation.y = (i * Math.PI) / 3;
        kit.batch(wheel);
        wheels.push(wheel);
        box(iron, g, [side * 6.5, -2.8, z], [5, 1, 4]);
      }
      for (let i = 0; i < 4; i++)
        box(cream, g, [side * 9.3, -i * 0.6, -car.length * 0.38], [0.2, 0.12, 2]);
      for (const z of [-car.length * 0.22, car.length * 0.16]) {
        const x = side * 8.6;
        if (style.cargo === "timber") {
          for (const y of [0.8, 2, 3.2])
            for (const dx of [-0.65, 0.65])
              mesh(cylinder, wood, g, [x + dx, y, z], [0.65, 13, 0.65]).rotation.x = Math.PI / 2;
        } else if (style.cargo === "pipes") {
          for (const y of [0.8, 2.1])
            mesh(pipeGeometry, silver, g, [x, y, z], [1, 15, 1]).rotation.x = Math.PI / 2;
        } else if (style.cargo === "crates") {
          box(wood, g, [x, 2, z], [2.2, 4, 10]);
          for (const y of [0.6, 3.4]) box(cream, g, [x, y, z + 5.03], [2.3, 0.2, 0.12]);
          tube(g, [x - 1, 0.2, z + 5.04], [x + 1, 3.8, z + 5.04], 0.09, dark);
        } else if (style.cargo === "tanks") {
          mesh(cylinder, silver, g, [x, 2, z], [1.3, 4, 1.3]);
          box(paint, g, [x, 2.2, z], [2.7, 0.45, 2.7]);
        }
      }
      if (style.cargo === "covered") {
        for (const z of [-car.length * 0.35, 0, car.length * 0.35])
          box(glow, g, [side * 8.7, 8.5, z], [0.12, 1.2, 3]);
      }
      // Reflective end posts frame the open coupling and the landing roof.
      for (const z of [-car.length / 2 + 0.3, car.length / 2 - 0.3]) {
        box(cream, g, [side * 8.7, 1.5, z], [0.3, 3, 0.35]);
        box(glow, g, [side * 8.7, 3, z], [0.45, 0.25, 0.5]);
      }
    }
    // Couplers sit well below the roof: the visible opening cannot be driven across.
    for (const sign of [-1, 1])
      box(
        iron,
        g,
        [0, -2.6, sign * (car.length / 2 + definition.gap / 4)],
        [1.1, 0.6, definition.gap / 2],
      );
    // Short cargo assemblies stay rigid; their anchors follow the curved roof.
    const anchors = new Map();
    for (const object of [...g.children]) {
      const z = object.position.z;
      if (!anchors.has(z)) {
        const anchor = new THREE.Group();
        g.add(anchor);
        anchors.set(z, anchor);
      }
      const anchor = anchors.get(z);
      object.position.z = 0;
      anchor.add(object);
    }
    for (const anchor of anchors.values()) {
      const axleWheels = wheels.filter((wheel) => wheel.parent === anchor);
      for (const wheel of axleWheels) anchor.remove(wheel);
      kit.batch(anchor);
      for (const wheel of axleWheels) anchor.add(wheel);
    }
    const body = ribbon(64, 3, paint, `${style.name} curved undercarriage`);
    const canopy =
      style.cargo === "covered" ? ribbon(64, 3, paint, `${style.name} covered passage`) : null;
    const inverse = new THREE.Quaternion();

    const deck = ribbon(64, 4, roofs[car.index % roofs.length], `${style.name} roof`);
    const launch = ribbon(32, 8, warning, `${style.name} gap launch ramp`);
    const update = (time) => {
      track.setTime(time);
      const pose = carriageAt(time, car.index);
      // Bodies follow the un-ramped middle of the carriage, with its suspension.
      w.align(g, track.poseAt(pose.t * track.TRACK, 0, -0.03));
      inverse.copy(g.quaternion).invert();
      for (const [z, anchor] of anchors) {
        const t = Math.max(pose.start, Math.min(pose.end, pose.t - z / track.COURSE_LENGTH));
        const frame = track.poseAt(t * track.TRACK, 0, -0.03);
        frame.p.y -= trainRampHeight(track, t);
        w.align(anchor, frame);
        anchor.position.sub(g.position).applyQuaternion(inverse);
        anchor.quaternion.premultiply(inverse);
      }
      const shell = (ribbon, profile) =>
        ribbon.update(
          (row, col) => {
            const t = pose.start + (pose.end - pose.start) * row;
            const [offset, height] = profile[Math.round(col * 3)];
            const p = track.poseAt(t * track.TRACK, offset, height).p;
            p.y -= trainRampHeight(track, t, offset);
            return p;
          },
          () => false,
        );
      shell(body, [
        [-9, -0.04],
        [-9, -3.4],
        [9, -3.4],
        [9, -0.04],
      ]);
      if (canopy)
        shell(canopy, [
          [-9, 0],
          [-9, 12],
          [9, 12],
          [9, 0],
        ]);
      wheels.forEach((wheel) => {
        wheel.rotation.y = (time * definition.speed) / 1.5;
      });
      deck.update(
        (row, col) => {
          const t = pose.start + (pose.end - pose.start) * row;
          const left = track.platformEdgeAt(t, -1);
          const offset = left + (track.platformEdgeAt(t, 1) - left) * col;
          const p = track.poseAt(t * track.TRACK, offset, 0.025).p;
          p.y -= trainRampHeight(track, t, offset);
          return p;
        },
        (row, col) => (col === 0 || col === 4) && Math.floor(row / 3) % 2 === 0,
      );

      const lipDistance = pose.distance + car.length / 2;
      const rampStart = lipDistance - ramp.length;
      const rampEndT =
        track.sectorT(definition.section, definition.startFraction) +
        lipDistance / track.COURSE_LENGTH;
      const moving = track.movingSurfaceAt(rampEndT - 0.01 / track.COURSE_LENGTH);
      launch.object.visible =
        !!moving && !moving.docked && rampStart >= 0 && lipDistance <= moving.length;
      if (launch.object.visible) {
        launch.update(
          (row, col) => {
            const u = row * 0.9999;
            const t =
              track.sectorT(definition.section, definition.startFraction) +
              (rampStart + ramp.length * u) / track.COURSE_LENGTH;
            const offset = style.offset + (col - 0.5) * ramp.width;
            const p = track.poseAt(t * track.TRACK, offset, 0.055).p;
            p.y -= trainRampHeight(track, t, offset);
            p.y += ramp.height * (1 - Math.sqrt(1 - u * u));
            return p;
          },
          (row, col) => (row + Math.abs(col - 4) * 2) % 12 < 4,
        );
      }
    };
    motion(g, update);
    update(0);
    return g;
  });
}
