import * as THREE from "../../../vendor/three/three.module.js";
import { createClockworkClearance } from "../adventure/clockwork-clearance.js";
import { registerLightPool } from "../../rendering/course-lighting.js";

/** A chamber enclosing both routes around an open movement well. */
export function buildWatchInterior({ track, kit, scenery, animated, updates, sign }) {
  const { mesh, box, material } = kit;
  const bowl = track.areaSurfaces[0];
  const section = track.SECTIONS[track.course.watchBowl.section];
  const a = track.frameAt(section.start).p;
  const center = bowl.center;
  const radius = bowl.radius;
  const brass = material("#cfa25d", { metalness: 0.65, roughness: 0.35 });
  const dark = material("#635340", { metalness: 0.4 });
  const room = new THREE.Group();
  scenery.add(room);
  room.position.copy(center);
  room.name = "Inside the watch movement";
  const allows = createClockworkClearance(track);
  // The chamber is open at both entrances and the entire inner race bowl.
  for (let i = 0; i < 28; i++) {
    const angle = (i * Math.PI * 2) / 28;
    const direction = a.clone().sub(center),
      gateAngle = Math.atan2(direction.z, direction.x);
    const gate = Math.abs(Math.sin(angle - gateAngle)) < 0.28;
    const r = radius + 38;
    const bay = new THREE.Group();
    room.add(bay);
    bay.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    bay.rotation.y = -angle;
    const bottom = track.course.theme.groundHeight - center.y;
    const height = 65 - bottom;
    const y = (65 + bottom) / 2;
    if (!gate && allows(bay, [0, y, 0], [8, height, (r * Math.PI * 2) / 28 + 2])) {
      const wall = box(dark, bay, [0, y, 0], [8, height, (r * Math.PI * 2) / 28 + 2]);
      wall.name = "Watch movement casing";
      const rib = box(brass, bay, [-4.4, y, 0], [0.4, height, 1.2]);
      rib.name = "Watch casing rib";
    }
  }
  const rim = mesh(new THREE.TorusGeometry(radius + 22, 1, 8, 96), brass, room, [0, 63, 0]);
  rim.rotation.x = Math.PI / 2;
  const top = mesh(new THREE.RingGeometry(radius + 8, radius + 25, 96), dark, room, [0, 65, 0]);
  top.rotation.x = Math.PI / 2;
  top.material.side = THREE.DoubleSide;
  // A dark, recessed shaft gives the open well depth instead of exposing sky
  // through the terrain excavation. Its rim follows just below the floor edge.
  const wellGeometry = new THREE.CylinderGeometry(
    bowl.innerRadius,
    bowl.innerRadius,
    44,
    96,
    1,
    true,
  );
  const wellPositions = wellGeometry.attributes.position;
  for (let i = 0; i < wellPositions.count; i++) {
    const p = center
      .clone()
      .add(new THREE.Vector3(wellPositions.getX(i), 0, wellPositions.getZ(i)));
    wellPositions.setY(
      i,
      wellPositions.getY(i) > 0 ? bowl.heightAt(p) - center.y - 0.1 : -bowl.depth - 46,
    );
  }
  wellGeometry.computeVertexNormals();
  const wellWall = mesh(wellGeometry, dark.clone(), room);
  wellWall.material.side = THREE.DoubleSide;
  wellWall.name = "Recessed gear well shaft";
  const wellBase = mesh(new THREE.CircleGeometry(bowl.innerRadius, 96), dark, room, [
    0,
    -bowl.depth - 46,
    0,
  ]);
  wellBase.rotation.x = -Math.PI / 2;
  wellBase.name = "Deep gear well base";
  // Deep gears and shafts make the central gap visibly fall into a watch.
  const gearGeo = kit.authoredGeometry("blender:gear-28", [2.15, 2.15, Math.sqrt(3) * 0.075]);
  for (let i = 0; i < 8; i++) {
    const angle = ((i + 0.5) * Math.PI) / 4,
      r = radius + 29;
    const mount = new THREE.Group();
    room.add(mount);
    mount.position.set(Math.cos(angle) * r, 8, Math.sin(angle) * r);
    mount.rotation.y = -angle - Math.PI / 2;
    const size = 9 + (i % 3) * 2;
    if (!allows(mount, [0, 0, 0], [size * 2 + 3, size * 2 + 3, 3])) {
      mount.removeFromParent();
      continue;
    }
    const rotor = new THREE.Group();
    mount.add(rotor);
    mesh(gearGeo, brass, rotor, [0, 0, 0], [size, size, size]);
    kit.batch(rotor);
    animated.push(rotor);
    updates.push((time) => {
      rotor.rotation.z = time * (i % 2 ? -0.2 : 0.16);
    });
  }
  for (let i = 0; i < 13; i++) {
    const angle = i * 2.4,
      r = bowl.innerRadius * (0.18 + (i % 3) * 0.22);
    const gear = new THREE.Group();
    room.add(gear);
    gear.position.set(Math.cos(angle) * r, -bowl.depth - 10 - (i % 4) * 5, Math.sin(angle) * r);
    const size = 3 + (i % 4);
    mesh(gearGeo, brass, gear, [0, 0, 0], [size, size, size]).rotation.x = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(1, 1, 18, 12), dark, gear, [0, -8, 0]);
    kit.batch(gear);
    animated.push(gear);
    updates.push((time) => {
      gear.rotation.y = time * (i % 2 ? -0.2 : 0.16);
    });
  }
  // Warm work lights expose the movement below the open bowl.
  for (const branch of track.branches) {
    if (branch.theme !== "watch") continue;
    for (const q of [0.25, 0.5, 0.75]) {
      const p = branch.poseAt(q).p;
      registerLightPool(scenery.parent, {
        position: p.clone().add(new THREE.Vector3(0, 10, 0)),
        color: "#ffdaa4",
        intensity: 36,
        radius: 45,
      });
    }
  }
  const entry = new THREE.Group();
  scenery.add(entry);
  kit.align(entry, track.poseAt((section.start - 6 / track.COURSE_LENGTH) * track.TRACK));
  sign(entry, "FOLLOW THE GOLD · BOTH LINES REJOIN", "#ffe0a0", 44);
  buildBowlGuidance(track, kit, scenery);
  const exit = new THREE.Group();
  scenery.add(exit);
  kit.align(exit, track.poseAt((section.end + 30 / track.COURSE_LENGTH) * track.TRACK));
  sign(exit, "EXIT · CLOCKMAKERS’ TERRACES", "#ffe0a0", 36);
}

/** Visible flowing lanes are guides; the entire saucer remains driveable. */
function buildBowlGuidance(track, kit, scenery) {
  const { mesh, material } = kit;
  const lane = material("#987544", { metalness: 0.4, roughness: 0.7 });
  const gold = material("#ffe1a0", {
    emissive: "#f9bc50",
    emissiveIntensity: 0.45,
    roughness: 0.5,
  });
  const guides = [];
  scenery.userData.bowlGuides = guides;
  for (const branch of track.branches.filter((b) => b.areaSurface)) {
    function strip(left, right, mat, name, above) {
      const positions = [],
        uv = [],
        indices = [];
      const rows = branch.count,
        columns = 6;
      for (let i = 0; i <= rows; i++) {
        const q = i / rows;
        const spread = 1 + 0.5 * Math.sin(q * Math.PI) ** 2;
        for (let j = 0; j <= columns; j++) {
          const offset = THREE.MathUtils.lerp(left, right, j / columns) * spread;
          const p = branch.poseAt(q, offset, above).p;
          positions.push(p.x, p.y, p.z);
          uv.push(j / columns, (q * branch.length) / 8);
          if (i < rows && j < columns) {
            const n = i * (columns + 1) + j;
            indices.push(n, n + 1, n + columns + 1, n + 1, n + columns + 2, n + columns + 1);
          }
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const object = mesh(geometry, mat);
      object.name = name;
      object.castShadow = false;
      object.userData.bakeReceiver = true;
      guides.push(object);
    }
    // Each marking layer needs its own clearance. Coplanar lane/guide meshes
    // fight for depth, and their different tessellation can cross on the curve.
    strip(-9.8, 9.8, lane, "Bowl route gently widens and converges", 0.035);
    strip(-0.3, 0.3, gold, "Continuous golden bowl guide", 0.07);
    for (const side of [-1, 1])
      strip(side * 8.8 - 0.12, side * 8.8 + 0.12, gold, "Bowl lane edge inlay", 0.07);
    for (let i = 1; i < 28; i++) {
      const q = i / 28;
      const frame = branch.frameAt(q);
      const right = new THREE.Vector3(-frame.tangent.z, 0, frame.tangent.x).normalize();
      const forward = frame.tangent.clone().setY(0).normalize();
      const positions = [];
      for (const [x, z] of [
        [-2.7, -1.8],
        [0, 0.6],
        [0, 1.4],
        [-2.7, -1],
        [0, 0.6],
        [2.7, -1.8],
        [2.7, -1],
        [0, 1.4],
      ]) {
        const p = frame.p.clone().addScaledVector(right, x).addScaledVector(forward, z);
        p.y = branch.areaSurface.heightAt(p) + 0.105;
        positions.push(p.x, p.y, p.z);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
      geometry.computeVertexNormals();
      const arrow = mesh(geometry, gold);
      arrow.material.side = THREE.DoubleSide;
      arrow.name = "Bowl forward chevron";
      arrow.castShadow = false;
      arrow.userData.bakeReceiver = true;
    }
  }
}
