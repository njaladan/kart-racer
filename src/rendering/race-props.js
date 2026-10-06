import * as THREE from "../../vendor/three/three.module.js";
import { bakeVertexShade } from "./vertex-shading.js";
import { bevelBox, batchStaticMeshes } from "./visuals.js";
import { addGlow } from "./visual-effects.js";
import {
  TRACK,
  activeTrack,
  frameAt,
  poseAt,
  BOOST_PADS,
  ITEM_ROW_DEFINITIONS,
} from "../track/track.js";

/** Build the finish landmark, boost panels, and collectible presentation records. */
export function createRaceProps({
  scene,
  materials: mats,
  createMaterial: mat,
  course: chosenCourse,
}) {
  const TAU = Math.PI * 2;
  function addMesh(geometry, material, parent = scene, position = null) {
    if (material.vertexColors) bakeVertexShade(geometry);
    const m = new THREE.Mesh(geometry, material);
    if (position) m.position.copy(position);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  const pads = [],
    boxes = [];
  function alignGroup(group, f) {
    group.position.copy(f.p);
    const z = f.tangent.clone().negate();
    const basis = new THREE.Matrix4().makeBasis(f.right, f.up, z);
    group.quaternion.setFromRotationMatrix(basis);
  }
  function addFinishArch() {
    const edge = activeTrack.surfaceAt(0);
    const postX = Math.max(-edge.leftEdge, edge.rightEdge) + 1.2;
    const span = postX * 2 + 1;
    const g = new THREE.Group(),
      post = mat("#f7f0d5", 0.36),
      accent = mat("#f76150", 0.5),
      beam = mat("#fa7654", 0.4);
    for (const x of [-postX, postX]) {
      const p = addMesh(new THREE.BoxGeometry(0.72, 13.4, 0.8), post, g);
      p.position.set(x, 6.7, 0);
      const a = addMesh(new THREE.BoxGeometry(0.9, 0.75, 1), accent, g);
      a.position.set(x, 13, 0);
    }
    const top = addMesh(bevelBox(span, 0.85, 0.9, 0.15), beam, g);
    top.position.set(0, 13.5, 0);
    const banner = document.createElement("canvas");
    banner.width = 1024;
    banner.height = 80;
    const bx = banner.getContext("2d");
    bx.fillStyle = "#f97652";
    bx.fillRect(0, 0, 1024, 80);
    bx.fillStyle = "#fff9e8";
    bx.font = "900 59px sans-serif";
    bx.textAlign = "center";
    bx.textBaseline = "middle";
    bx.fillText(`★  ${chosenCourse.name.toUpperCase()}  ★`, 512, 43, 1000);
    const bt = new THREE.CanvasTexture(banner);
    bt.colorSpace = THREE.SRGBColorSpace;
    for (const z of [-0.46, 0.46]) {
      const sign = addMesh(
        new THREE.PlaneGeometry(13, 0.72),
        new THREE.MeshBasicMaterial({ map: bt }),
        g,
      );
      sign.position.set(0, 13.5, z);
      if (z > 0) sign.rotation.y = Math.PI;
      sign.castShadow = false;
    }
    for (let i = 0; i < 12; i++) {
      const tile = addMesh(
        new THREE.BoxGeometry(1.5, 0.16, 0.95),
        i % 2 ? mats.white : mats.black,
        g,
      );
      tile.position.set(-8.25 + i * 1.5, 13.04, 0);
    }
    alignGroup(g, frameAt(0));
    scene.add(g);
    batchStaticMeshes(g);
    const f = frameAt(0),
      center = f.p.clone().addScaledVector(f.up, 0.13);
    for (let row = 0; row < 2; row++)
      for (let j = 0; j < 20; j++) {
        const x = -7.7 + j * 0.81,
          z = -0.18 + row * 0.36,
          p = center.clone().addScaledVector(f.right, x).addScaledVector(f.tangent, z),
          tile = addMesh(
            new THREE.BoxGeometry(0.82, 0.045, 0.38),
            (row + j) % 2 ? mats.white : mats.black,
          );
        tile.position.copy(p);
        tile.quaternion.setFromRotationMatrix(
          new THREE.Matrix4().makeBasis(f.right, f.up, f.tangent.clone().negate()),
        );
        tile.castShadow = false;
      }
  }
  function addPads() {
    for (const pad of BOOST_PADS) {
      const { t, offset } = pad;
      const g = new THREE.Group(),
        base = addMesh(new THREE.BoxGeometry(4.5, 0.18, 6.8), mats.pad, g);
      base.position.y = 0.11;
      for (let i = -1; i <= 1; i++) {
        const strip = addMesh(new THREE.BoxGeometry(0.18, 0.07, 5.8), mats.neon, g);
        strip.position.set(i * 1.32, 0.23, 0);
      }
      addGlow(g, { color: "#5ef9eb", size: [4.4, 2], opacity: 0.3, position: [0, 0.32, 0] });
      alignGroup(g, poseAt(t * TRACK, offset, 0));
      scene.add(g);
      pads.push({ g, ...pad, phase: Math.random() * TAU });
    }
  }
  function itemCubeMaterial() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d");
    x.fillStyle = "#4debd2";
    x.fillRect(0, 0, 128, 128);
    x.strokeStyle = "#eaffff";
    x.lineWidth = 9;
    x.strokeRect(7, 7, 114, 114);
    x.fillStyle = "#052c3b";
    x.font = "900 94px sans-serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText("?", 64, 67);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.22,
      metalness: 0.22,
      emissive: "#0e9e8b",
      emissiveMap: texture,
      emissiveIntensity: 0.65,
    });
  }
  const boxMaterial = itemCubeMaterial();
  function addItemBoxes() {
    // District rows can opt into exact world-space offsets for aprons/verges.
    const defaultOffsets = [-0.58, 0, 0.58];
    const rows = ITEM_ROW_DEFINITIONS.flatMap((row) =>
      (row.offsets || defaultOffsets).map((offset, lane) => ({ row, offset, lane })),
    );
    for (const { row, offset, lane } of rows) {
      let s = row.t * TRACK,
        group = new THREE.Group(),
        cube = addMesh(new THREE.BoxGeometry(1.65, 1.65, 1.65), boxMaterial, group);
      cube.castShadow = true;
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1.72, 1.72, 1.72)),
        new THREE.LineBasicMaterial({ color: "#eaffff" }),
      );
      group.add(wire);
      addGlow(group, { color: "#65ffe2", size: 3.3, opacity: 0.25 });
      const b = {
        s,
        x: row.offsets ? offset / 6.25 : defaultOffsets[lane],
        group,
        cube,
        active: true,
        respawn: 0,
        phase: Math.random() * TAU,
      };
      scene.add(group);
      boxes.push(b);
    }
  }

  addFinishArch();
  addPads();
  addItemBoxes();
  return { pads, boxes };
}
