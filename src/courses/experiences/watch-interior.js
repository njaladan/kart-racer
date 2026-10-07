import * as THREE from "../../../vendor/three/three.module.js";
import { createClockworkClearance } from "../adventure/clockwork-clearance.js";
import { registerLightPool } from "../../rendering/course-lighting.js";

/** A chamber enclosing both routes around an open movement well. */
export function buildWatchInterior({ track, kit, scenery, animated, updates, sign }) {
  const { mesh, box, material } = kit;
  const section = track.SECTIONS[track.course.watchBowl.section];
  const a = track.frameAt(section.start).p,
    b = track.frameAt(section.end).p;
  const center = a.clone().add(b).multiplyScalar(0.5);
  const radius = Math.hypot(a.x - b.x, a.z - b.z) / 2;
  const brass = material("#cfa25d", { metalness: 0.65, roughness: 0.35 });
  const dark = material("#354457", { metalness: 0.4 });
  const cream = material("#dfceb5");
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
    const gate = Math.abs(Math.sin(angle - gateAngle)) < 0.16;
    const r = radius + 38;
    const bay = new THREE.Group();
    room.add(bay);
    bay.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    bay.rotation.y = -angle;
    if (!gate && allows(bay, [0, 20, 0], [8, 90, (r * Math.PI * 2) / 28 + 2])) {
      const wall = box(dark, bay, [0, 20, 0], [8, 90, (r * Math.PI * 2) / 28 + 2]);
      wall.name = "Watch movement casing";
      const rib = box(brass, bay, [-4.4, 20, 0], [0.4, 90, 1.2]);
      rib.name = "Watch casing rib";
    }
  }
  const rim = mesh(new THREE.TorusGeometry(radius + 22, 1, 8, 96), brass, room, [0, 63, 0]);
  rim.rotation.x = Math.PI / 2;
  const top = mesh(new THREE.RingGeometry(radius * 0.35, radius + 25, 96), dark, room, [0, 65, 0]);
  top.rotation.x = Math.PI / 2;
  top.material.side = THREE.DoubleSide;
  // Deep gears and shafts make the central gap visibly fall into a watch.
  const gearGeo = new THREE.TorusGeometry(1, 0.075, 6, 40);
  for (let i = 0; i < 8; i++) {
    const angle = ((i + 0.5) * Math.PI) / 4,
      r = radius + 29;
    const mount = new THREE.Group();
    room.add(mount);
    mount.position.set(Math.cos(angle) * r, 8, Math.sin(angle) * r);
    mount.rotation.y = -angle - Math.PI / 2;
    const rotor = new THREE.Group();
    mount.add(rotor);
    const size = 9 + (i % 3) * 2;
    mesh(gearGeo, brass, rotor, [0, 0, 0], [size, size, size]);
    for (let n = 0; n < 24; n++) {
      const q = (n * Math.PI) / 12;
      box(brass, rotor, [Math.cos(q) * size, Math.sin(q) * size, 0], [1.5, 1.5, 0.8]).rotation.z =
        q;
      if (n % 6 === 0)
        box(
          cream,
          rotor,
          [(Math.cos(q) * size) / 2, (Math.sin(q) * size) / 2, 0],
          [size, 0.45, 0.5],
        ).rotation.z = q;
    }
    kit.batch(rotor);
    animated.push(rotor);
    updates.push((time) => {
      rotor.rotation.z = time * (i % 2 ? -0.2 : 0.16);
    });
  }
  for (let i = 0; i < 13; i++) {
    const angle = i * 2.4,
      r = radius * (0.13 + (i % 3) * 0.11);
    const gear = new THREE.Group();
    room.add(gear);
    gear.position.set(Math.cos(angle) * r, -12 - (i % 4) * 4, Math.sin(angle) * r);
    const size = 13 + (i % 4) * 3;
    mesh(gearGeo, brass, gear, [0, 0, 0], [size, size, size]).rotation.x = Math.PI / 2;
    for (let n = 0; n < 24; n++) {
      const q = (n * Math.PI * 2) / 24;
      const tooth = box(brass, gear, [Math.cos(q) * size, 0, Math.sin(q) * size], [1.8, 1.4, 1.4]);
      tooth.rotation.y = -q;
      if (n % 6 === 0)
        box(
          cream,
          gear,
          [(Math.cos(q) * size) / 2, 0, (Math.sin(q) * size) / 2],
          [size, 0.5, 0.8],
        ).rotation.y = -q;
    }
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
  sign(entry, "INSIDE THE WATCH · LEFT OR RIGHT", "#eac68b", 28);
}
