import { buildWatchInterior } from "./watch-interior.js";
import * as THREE from "../../../vendor/three/three.module.js";
import { createCourseKit, batchScenery } from "../../rendering/course-kit.js";
import { stormAt, mountainHeight } from "../../simulation/experience-mechanics.js";
import { branchRampHeight } from "../../track/route-branches.js";
import { carvedSandstone, templePaving } from "../sunstone-ruins/sunstone-materials.js";
import { metalDeckDetail } from "../adventure/architectural-detail.js";

/** Authored route surfaces and their scenery are built from authoritative frames. */
export function buildExperienceWorld({ scene, track, textures = {}, assets = {} }) {
  const scenery = new THREE.Group();
  scenery.name = `${track.course.name} course experience`;
  scene.add(scenery);
  const kit = createCourseKit(scenery, track, assets);
  const { mesh, box, material } = kit;
  const animated = [],
    updates = [];
  const metal = material("#b9a374", { map: textures.metal, metalness: 0.52, roughness: 0.48 });
  const stone = material("#837269", { map: textures.stone });
  if (track.course.id === "sunstone-ruins") carvedSandstone(stone, { carved: true });
  const wood = material("#b69a78", { map: textures.wood });
  const leaf = material("#597c65", { map: textures.leaves });
  const sphere = new THREE.SphereGeometry(1, 10, 7);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 16);
  const ring = new THREE.TorusGeometry(1, 0.04, 6, 40);
  const glow = (color) => material(color, { emissive: color, emissiveIntensity: 0.7 });
  function groupAt(pose) {
    const group = new THREE.Group();
    scenery.add(group);
    kit.align(group, pose);
    return group;
  }
  function sign(parent, text, color, width = 16) {
    const backing = box(material("#263c43"), parent, [0, 15, 0], [width, 2, 0.4]);
    backing.name = text;
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = 768;
      canvas.height = 96;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#263c43";
        ctx.fillRect(0, 0, 768, 96);
        ctx.font = "bold 38px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = color;
        ctx.fillText(text, 384, 48, 730);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        mesh(
          new THREE.PlaneGeometry(width, 2),
          new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
          parent,
          [0, 15, -0.23],
        );
      }
    }
    for (const side of [-1, 1])
      box(metal, parent, [side * (width / 2 + 1.5), 7.5, 0], [0.24, 15, 0.24]);
  }
  function ribbon(frame, halfWidth, mat, count = 120) {
    const positions = new Float32Array((count + 1) * 6),
      uv = [],
      indices = [];
    for (let i = 0; i <= count; i++) {
      uv.push(0, i / 6, 1, i / 6);
      if (i < count) {
        const n = i * 2;
        indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices);
    const road = mesh(geo, mat);
    road.name = "Authored experience driving surface";
    road.receiveShadow = true;
    const update = () => {
      for (let i = 0; i <= count; i++) {
        for (let side = 0; side < 2; side++) {
          const pose = frame(i / count, (side ? 1 : -1) * halfWidth),
            p = pose.p;
          const n = (i * 2 + side) * 3;
          positions[n] = p.x;
          positions[n + 1] = p.y - 0.025;
          positions[n + 2] = p.z;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
    };
    update();
    return { road, update };
  }
  for (const branch of track.branches) {
    const branchGroup = new THREE.Group();
    branchGroup.name = branch.label;
    scenery.add(branchGroup);
    const textureName =
      branch.material === "paper"
        ? "fabric"
        : branch.material === "snow"
          ? "frostSnow"
          : branch.material === "ice"
            ? "frostIce"
            : branch.material;
    const map = textures[textureName];
    const mat = material(branch.color, {
      map,
      roughness: branch.material === "glass" ? 0.32 : 0.8,
      metalness: branch.material === "metal" ? 0.4 : 0,
    });
    if (branch.theme === "sun-ring") templePaving(mat, { ceremonial: true });
    if (branch.theme === "containers" || branch.theme === "watch") metalDeckDetail(mat);
    // The landing deck stays flat underneath a curved, open launch lip.
    // A separate plate prevents the ribbon from creating a roller downslope.
    const deckPose = (q, offset) => {
      const pose = branch.poseAt(q, offset);
      pose.p.y -= branchRampHeight(branch, q);
      return pose;
    };
    const built = ribbon(deckPose, branch.halfWidth, mat, branch.count);
    branchGroup.add(built.road);
    const trim = glow(branch.color);
    if (branch.ramp) {
      const ramp = branch.ramp;
      const launch = ribbon(
        (u, offset) => {
          const pose = deckPose(ramp.start + (ramp.lip - ramp.start) * u, offset);
          pose.p.y += ramp.height * (1 - Math.sqrt(Math.max(0, 1 - u * u))) + 0.035;
          return pose;
        },
        branch.halfWidth,
        metal,
        48,
      );
      branchGroup.add(launch.road);
      launch.road.name = "Curved quarterpipe with open launch lip";
      const lip = groupAt(branch.poseAt(ramp.lip, 0, ramp.height));
      branchGroup.add(lip);
      box(trim, lip, [0, 0, 0], [branch.halfWidth * 2, 0.08, 0.18]);
    }
    const entrance = groupAt(branch.poseAt(0.035));
    sign(entrance, branch.label, branch.color, 24);
    const count = Math.max(5, Math.floor(branch.length / 12));
    for (let i = 1; i < count; i++) {
      const q = i / count,
        pose = branch.poseAt(q, 0, 0),
        g = groupAt(pose);
      branchGroup.add(g);
      if (!branch.dropToMain) {
        for (const side of [-1, 1]) {
          box(
            metal,
            g,
            [side * branch.halfWidth, 0.35, 0],
            [0.3, 0.7, branch.length / count + 0.2],
          );
          box(trim, g, [side * (branch.halfWidth - 0.35), 0.075, 0], [0.16, 0.08, 3.6]);
        }
      }
      if (branch.theme === "containers" && q > 0.22 && q < 0.84) {
        g.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), track.yawFor(pose.tangent));
        g.position.y -= branchRampHeight(branch, q);
        const container = material(i % 3 === 0 ? "#a75945" : i % 3 === 1 ? "#3a8289" : "#d0a54e", {
          map: textures.metal,
          metalness: 0.35,
        });
        box(container, g, [0, -2.9, 0], [branch.halfWidth * 2, 5.8, branch.length / count + 0.3]);
        for (let n = 0; n < 10; n++)
          box(
            container,
            g,
            [0, 0.025, (n - 4.5) * (branch.length / count / 10)],
            [branch.halfWidth * 2, 0.05, 0.08],
          );
        for (const side of [-1, 1]) {
          for (let n = 0; n < 8; n++)
            box(
              metal,
              g,
              [side * (branch.halfWidth + 0.015), -2.9, (n - 3.5) * 1.35],
              [0.06, 5.6, 0.12],
            );
          box(trim, g, [side * (branch.halfWidth - 0.25), 0.05, 0], [0.12, 0.07, 3]);
        }
      }
      if (branch.theme === "grove") {
        for (const side of [-1, 1]) {
          const roots = Math.max(0, pose.p.y - (track.course.theme.groundHeight ?? -1.7));
          if (kit.hasAsset("windmill:oak"))
            kit.asset("windmill:oak", g, [side * 15, -roots, 0], [18, 18, 18]);
          else {
            mesh(cylinder, wood, g, [side * 15, 6 - roots, 0], [1.2, 12, 1.2]);
            mesh(sphere, leaf, g, [side * 15, 12 - roots, 0], [5, 5, 5]);
          }
          mesh(sphere, glow("#c3efa2"), g, [side * 7, 3 + (i % 3), 0], [0.17, 0.17, 0.17]);
          box(wood, g, [side * 5.2, -2.2, 0], [0.7, 4.4, 0.7]);
        }
        if (i % 5 === 0)
          mesh(new THREE.TorusGeometry(1, 0.12, 8, 24, Math.PI), wood, g, [0, 0, 0], [11, 18, 11]);
        for (let plank = 0; plank < 6; plank++)
          box(wood, g, [0, -0.12, (plank - 2.5) * 1.8], [10.8, 0.22, 0.12]);
      }
      if (branch.theme === "reef") {
        for (const side of [-1, 1]) {
          const coral = material(i % 2 ? "#c58fd2" : "#dcaa98");
          for (let stem = 0; stem < 3; stem++) {
            mesh(
              cylinder,
              coral,
              g,
              [side * (10 + stem * 1.4), 2 + stem, 0],
              [0.35, 4 + stem * 2, 0.35],
            ).rotation.z = side * (0.15 + stem * 0.1);
            mesh(sphere, trim, g, [side * (10 + stem * 1.8), 4 + stem * 2, 0], [0.4, 0.4, 0.4]);
          }
        }
        if (i % 4 === 0)
          mesh(new THREE.TorusGeometry(1, 0.1, 8, 32, Math.PI), stone, g, [0, 1, 0], [12, 20, 12]);
        const eel = new THREE.Group();
        g.add(eel);
        eel.position.set(-10, 9, 0);
        for (let n = 0; n < 9; n++)
          mesh(sphere, trim, eel, [Math.sin(n * 0.8) * 0.6, n * 0.3, n * 1.1], [0.42, 0.38, 0.65]);
        kit.batch(eel);
        animated.push(eel);
        updates.push((time) => {
          eel.rotation.y = Math.sin(time * 0.4 + i) * 0.5;
          eel.position.y = 9 + Math.sin(time * 0.8 + i);
        });
      }
      if (branch.theme === "sun-ring") {
        for (const side of [-1, 1]) {
          box(stone, g, [side * 10, 6, 0], [2.7, 12, 2.7]);
          box(trim, g, [side * 10, 11.5, 0], [3.5, 0.5, 3.5]);
        }
        if (i % 5 === 0) {
          mesh(new THREE.TorusGeometry(1, 0.06, 8, 48), metal, g, [0, 13, 0], [10, 10, 10]);
          box(trim, g, [0, 13, 0], [1, 1, 0.4]);
        }
      }
      if (branch.theme === "snow") {
        for (const side of [-1, 1]) {
          box(i % 2 ? trim : wood, g, [side * (branch.halfWidth + 1), 1, 0], [0.12, 2, 0.12]);
          if (
            q > 0.25 &&
            q < 0.8 &&
            side === (branch.id === "glacier-chute" ? -1 : 1) &&
            kit.hasAsset("frostpeak:pine-near")
          ) {
            kit
              .asset("frostpeak:pine-near", g, [side * 22, -0.1, 0], [7, 9, 7])
              .quaternion.copy(g.quaternion)
              .invert();
          }
        }
      }
      if (branch.theme === "paper") {
        for (const side of [-1, 1]) {
          mesh(
            new THREE.ConeGeometry(1, 1, 3),
            mat,
            g,
            [side * 21, -1, 0],
            [8, 10 + (i % 4), 8],
          ).rotation.z = side * 0.28;
          box(trim, g, [side * (branch.halfWidth - 0.3), 0.05, 0], [0.2, 0.06, 4]);
        }
      }
    }
    if (branch.carrierSpeed) {
      const striped = mat.map?.clone();
      if (striped) {
        striped.wrapS = striped.wrapT = THREE.RepeatWrapping;
        mat.map = striped;
        updates.push((time) => {
          striped.offset.y = (-time * branch.carrierSpeed) / 8;
        });
      }
      for (let i = 0; i < 8; i++) {
        const marker = groupAt(branch.poseAt((i + 0.5) / 8));
        box(trim, marker, [0, 0.035, 0], [5, 0.05, 0.3]);
        animated.push(marker);
        updates.push((time) =>
          kit.align(
            marker,
            branch.poseAt(
              0.14 +
                (((((i + 0.5) / 8 + (time * branch.carrierSpeed) / branch.length) % 0.72) + 0.72) %
                  0.72),
            ),
          ),
        );
      }
    }
    if (branch.lap != null) {
      batchScenery(branchGroup);
      animated.push(branchGroup);
      updates.push((_time, state) => {
        const occupied = state?.racers?.some((r) => r.routeChoice === branch.index);
        branchGroup.visible = !state || (state.playerLap || 0) % 3 === branch.lap || occupied;
        entrance.visible = branchGroup.visible;
      });
    }
  }
  if (track.course.downhill) {
    const d = track.course.downhill,
      section = track.SECTIONS[d.section];
    const rows = 100,
      columns = 30,
      positions = [],
      uv = [],
      indices = [];
    for (let row = 0; row <= rows; row++) {
      const t = section.start + ((section.end - section.start) * row) / rows;
      const fade = Math.min(1, row / 8, (rows - row) / 8);
      const width = track.roadHalfWidth(t) + (d.width - track.roadHalfWidth(t)) * fade;
      for (let col = 0; col <= columns; col++) {
        const offset = ((col / columns) * 2 - 1) * width;
        const p = track.poseAt(t * track.TRACK, offset, 0).p;
        p.y = mountainHeight(track, p, t) - 0.025;
        positions.push(p.x, p.y, p.z);
        uv.push(col / 3, row / 6);
        if (row < rows && col < columns) {
          const n = row * (columns + 1) + col;
          indices.push(n, n + 1, n + columns + 1, n + 1, n + columns + 2, n + columns + 1);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mountain = mesh(geo, material("#eef3ff", { map: textures.frostSnow || textures.snow }));
    mountain.name = "Open Dragonback downhill snow face";
  }
  if (track.course.watchBowl) buildWatchInterior({ track, kit, scenery, animated, updates, sign });
  if (track.drumField) {
    const drumMaterials = ["#b77982", "#7b97bd", "#c7a260", "#74a69c", "#9c83b3", "#d68e60"].map(
      (color) => material(color, { map: textures.metal, metalness: 0.45 }),
    );
    const head = material("#ede5d2", { roughness: 0.86 });
    for (const drum of track.drumField.drums) {
      const g = groupAt(track.poseAt(drum.t * track.TRACK, drum.offset, 0));
      g.name = `Snare drum ${drum.index + 1}`;
      g.quaternion.setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        track.yawFor(track.frameAt(drum.t).tangent) + Math.PI,
      );
      mesh(
        cylinder,
        drumMaterials[drum.index % drumMaterials.length],
        g,
        [0, -2.7, 0],
        [drum.radius, 5.4, drum.radius],
      );
      mesh(cylinder, head, g, [0, -0.04, 0], [drum.radius - 0.08, 0.08, drum.radius - 0.08]);
      for (const y of [-0.06, -5.3])
        mesh(ring, metal, g, [0, y, 0], [drum.radius, drum.radius, drum.radius]).rotation.x =
          Math.PI / 2;
      for (let n = 0; n < 12; n++) {
        const a = (n * Math.PI) / 6;
        box(
          metal,
          g,
          [Math.cos(a) * (drum.radius + 0.05), -2.7, Math.sin(a) * (drum.radius + 0.05)],
          [0.18, 4.8, 0.18],
        );
      }
      mesh(
        ring,
        glow("#e0b56b"),
        g,
        [0, 0.025, 0],
        [drum.radius * 0.7, drum.radius * 0.7, drum.radius * 0.7],
      ).rotation.x = Math.PI / 2;
    }
    sign(
      groupAt(track.poseAt((track.drumField.start - 10 / track.COURSE_LENGTH) * track.TRACK)),
      "SNARE DRUM GORGE · BOUNCE ACROSS",
      "#f5d298",
      25,
    );
  }
  if (track.course.bridgeSway) {
    for (const index of track.course.bridgeSway) {
      const section = track.SECTIONS[index];
      const deck = ribbon(
        (q, offset) =>
          track.poseAt(
            (section.start + (section.end - section.start) * q) * track.TRACK,
            offset,
            0.055,
          ),
        section.halfWidth + 0.5,
        material(track.course.theme.road, { map: textures.stone, roughness: 0.3, metalness: 0.1 }),
        Math.ceil(((section.end - section.start) * track.COURSE_LENGTH) / 2),
      );
      animated.push(deck.road);
      updates.push(() => deck.update());
    }
    const lightning = new THREE.DirectionalLight("#d9eaff", 0);
    lightning.position.set(90, 180, -60);
    scene.add(lightning);
    animated.push(lightning);
    updates.push((time, state) => {
      lightning.intensity =
        state?.motionEnabled === false ? 0 : stormAt(track.course, time).flash * 5;
    });
    const boltGeo = new THREE.BufferGeometry();
    boltGeo.setFromPoints([
      new THREE.Vector3(190, 250, -260),
      new THREE.Vector3(175, 190, -253),
      new THREE.Vector3(196, 150, -246),
      new THREE.Vector3(168, 85, -240),
      new THREE.Vector3(180, 20, -235),
    ]);
    const bolt = new THREE.Line(boltGeo, new THREE.LineBasicMaterial({ color: "#e2eeff" }));
    scene.add(bolt);
    animated.push(bolt);
    updates.push((time, state) => {
      bolt.visible = state?.motionEnabled !== false && stormAt(track.course, time).flash > 0.1;
    });
  }
  return {
    scenery,
    animated,
    update(time, state) {
      updates.forEach((update) => update(time, state));
    },
  };
}
