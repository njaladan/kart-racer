import { patchMaterial } from "../../rendering/surface-detail.js";

/** A jewel-box concert interior: velvet, brass, balconies and dancing dust. */
export function metronomeArt(w) {
  const { THREE, track, kit, mat, safe, asset, mesh, box, motion, lamp, beam, particles } = w;
  const wood = mat("#784c3c", "wood"),
    gold = mat("#e6c383", "metal", { metalness: 0.72, roughness: 0.27 });
  const velvet = mat("#303b60", "fabric", { roughness: 0.98 });
  patchMaterial(velvet, "velvet-weave", (shader) => {
    shader.vertexShader = `varying vec3 vVelvet;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvVelvet=position;",
    );
    shader.fragmentShader = `varying vec3 vVelvet;\n${shader.fragmentShader}`.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
    float folds=.67+.33*pow(.5+.5*cos(vVelvet.x*45.),2.);
    float weave=sin(vVelvet.x*620.)*sin(vVelvet.y*620.);
    diffuseColor.rgb*=folds+weave*.025;`,
    );
  });
  for (let section = 0; section < track.SECTIONS.length; section++) {
    for (let i = 0; i < 3; i++) {
      for (const side of [-1, 1]) {
        if (section === 4 && i === 0 && side === -1) continue;
        if (section === 2 && side === (i % 2 ? 1 : -1)) continue;
        const g = safe(section, (i + 0.5) / 3, side * 46, 15);
        if (!g) continue;
        // Deep pleated curtains and balconies make enclosure tangible.
        box(wood, g, [0, 22, 0], [2, 46, 21]);
        mesh(
          kit.authoredGeometry("blender:velvet-drape"),
          velvet,
          g,
          [-side * 2, 25, 0],
          [1, 40, 18],
        );
        for (const z of [-10, 10]) {
          mesh(new THREE.CylinderGeometry(0.5, 0.65, 46, 10), gold, g, [0, 23, z]);
          mesh(new THREE.SphereGeometry(1.3, 10, 8), gold, g, [0, 47, z]);
        }
        box(wood, g, [-side * 8, 17, 0], [15, 2, 22]);
        box(gold, g, [-side * 15, 21, 0], [0.3, 6, 22]);
        for (let j = 0; j < 6; j++) box(gold, g, [-side * 15, 20, j * 3.6 - 9], [0.22, 6, 0.22]);
        if (i === 0) {
          asset("chairrounded", g, [-side * 5, 18, -5], 4);
          asset("books", g, [-side * 4, 18, 5], 2);
        }
        lamp(g, [-side * 6, 33, 0], "#ffcd86", 42, 48);
        if (i % 2 === 0) beam(g, [-side * 9, 40, 0], "#ffdcab", 43, 8, side * 0.3);
      }
    }
    const desk = section === 0 ? safe(section, 0.35, 82, 18) : null;
    if (desk) {
      box(wood, desk, [0, 1, 0], [36, 2, 23]);
      if (kit.hasAsset("hero:boombox")) kit.fitAsset("hero:boombox", desk, [0, 2, 0], 14);
      else asset("radio", desk, [0, 2, 0], 14);
      for (const x of [-22, 22]) asset("speaker", desk, [x, 0, 0], 19);
      asset("lamproundtable", desk, [-14, 2, -4], 10);
      lamp(desk, [-14, 10, -4], "#ffce8c", 35, 45);
    }
  }
  // Floating gilt notes turn slowly above the musical machinery.
  for (let i = 0; i < 10; i++) {
    const g = safe(i % track.SECTIONS.length, 0.15 + (i % 5) * 0.16, i % 2 ? 30 : -30, 4);
    if (!g) continue;
    const note = new THREE.Group();
    g.add(note);
    note.position.y = 15 + (i % 4) * 3;
    mesh(new THREE.SphereGeometry(1, 12, 8), gold, note, [0, 0, 0], [1.3, 0.7, 0.8]);
    box(gold, note, [1, 3, 0], [0.22, 6, 0.3]);
    box(gold, note, [2.1, 5.8, 0], [2.4, 0.4, 0.35]);
    const y = note.position.y;
    motion(note, (time) => {
      note.position.y = y + Math.sin(time * 0.6 + i) * 0.7;
      note.rotation.y = time * 0.12 + i;
    });
  }
  particles({ color: "#ffd893", count: 350, size: 0.13, height: 24, speed: 0.2, offset: 10 });
  particles({ color: "#d4bfff", style: "star", count: 140, size: 0.22, height: 18, offset: 22 });
}
