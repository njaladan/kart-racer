import * as THREE from "../../vendor/three/three.module.js";

function probeEnclosed(section) {
  return (
    section.enclosed ||
    [
      "forest",
      "rootwood",
      "root-wood",
      "woods",
      "pines",
      "warehouse",
      "temple",
      "canyon",
      "ice-cave",
      "ferry",
    ].includes(section.id)
  );
}

function selectSpread(sections, count) {
  if (count <= 0 || sections.length === 0) return [];
  if (sections.length <= count) return sections;
  return Array.from(
    { length: count },
    (_, index) => sections[Math.floor(((index + 0.5) * sections.length) / count)],
  );
}

export function selectCourseProbeSectors(track) {
  const sections = track?.SECTIONS || [];
  if (!sections.length) return [];
  const enclosed = sections.filter(probeEnclosed);
  const outdoor = sections.filter((section) => !probeEnclosed(section));
  const interiorCount = Math.min(2, enclosed.length);
  const outdoorCount = Math.min(outdoor.length, enclosed.length ? 4 - interiorCount : 4);
  const selected = [
    ...selectSpread(outdoor, outdoorCount),
    ...selectSpread(enclosed, interiorCount),
  ];
  for (const section of selectSpread(sections, Math.min(4, sections.length))) {
    if (selected.length >= 4) break;
    if (!selected.includes(section)) selected.push(section);
  }
  return selected.slice(0, 4).map((section) => ({ section, enclosed: probeEnclosed(section) }));
}

/** Generate deterministic light probes once at load, then prefilter for PBR roughness. */
export function createReflectionPixels(theme = {}, enclosed = false, width = 256, height = 128) {
  const night = theme.terrain === "concrete";
  const sky = new THREE.Color(theme.sky || "#73c4ec");
  const horizon = new THREE.Color(theme.fog || "#b9dbe7");
  const ground = new THREE.Color(theme.ground || "#6f9052");
  const sun = new THREE.Color(theme.sun || "#fff1cc");
  const data = new Float32Array(width * height * 4);
  const color = new THREE.Color();
  const accent = new THREE.Color();
  const neonColors = [
    new THREE.Color("#16dded"),
    new THREE.Color("#fa55af"),
    new THREE.Color("#ffbd64"),
  ];
  for (let y = 0; y < height; y++) {
    const elevation = Math.cos((y / (height - 1)) * Math.PI);
    for (let x = 0; x < width; x++) {
      const longitude = (x / width) * Math.PI * 2;
      if (elevation >= 0) color.copy(horizon).lerp(sky, Math.sqrt(elevation));
      else color.copy(horizon).lerp(ground, Math.min(1, -elevation * 2.5));
      const sunDot = Math.sin(longitude) * Math.sqrt(1 - elevation ** 2) * 0.58 + elevation * 0.82;
      color.add(
        accent.copy(sun).multiplyScalar(Math.pow(Math.max(0, sunDot), 110) * (night ? 0.38 : 4)),
      );
      if (night && Math.abs(elevation) < 0.42) {
        const band = Math.max(0, Math.sin(longitude * 11 + 0.3)) ** 18;
        color.add(
          accent
            .copy(neonColors[Math.floor((x / width) * 9) % 3])
            .multiplyScalar(band * (1 - Math.abs(elevation) / 0.42) * 1.5),
        );
      }
      if (enclosed) color.multiplyScalar(0.42 + Math.max(0, Math.cos(longitude * 3)) ** 8 * 0.24);
      const i = (y * width + x) * 4;
      data[i] = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = 1;
    }
  }
  return data;
}

export function createCourseEnvironments(renderer, theme) {
  const generator = new THREE.PMREMGenerator(renderer);
  const targets = [];
  for (const enclosed of [false, true]) {
    const texture = new THREE.DataTexture(
      createReflectionPixels(theme, enclosed),
      256,
      128,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.needsUpdate = true;
    targets.push(generator.fromEquirectangular(texture));
    texture.dispose();
  }
  const probes = [];
  let captureCount = 0;
  const environments = {
    exterior: targets[0].texture,
    interior: targets[1].texture,
    /** Capture a small fixed set of sector probes after course scenery is composed. */
    capture(scene, track) {
      if (!track?.SECTIONS?.length || !renderer?.isWebGLRenderer) return 0;
      const candidates = selectCourseProbeSectors(track);
      const previousEnvironment = scene.environment;
      const previousBackground = scene.background;
      const previousTarget = renderer.getRenderTarget();
      const previousXr = renderer.xr.enabled;
      const previousShadowAuto = renderer.shadowMap.autoUpdate;
      const previousToneMapping = renderer.toneMapping;
      const previousColorSpace = renderer.outputColorSpace;
      const previousExposure = renderer.toneMappingExposure;
      const previousAutoClear = renderer.autoClear;
      const previousShadowEnabled = renderer.shadowMap.enabled;
      const previousClearColor = renderer.getClearColor(new THREE.Color()).clone();
      const previousClearAlpha = renderer.getClearAlpha();
      const previousViewport = renderer.getViewport(new THREE.Vector4()).clone();
      const previousScissor = renderer.getScissor(new THREE.Vector4()).clone();
      const previousScissorTest = renderer.getScissorTest();
      const hidden = [];
      const environmentMaterials = [];
      let fresh = [];
      const cubeTarget = new THREE.WebGLCubeRenderTarget(64, {
        type: THREE.HalfFloatType,
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
      });
      const cubeCamera = new THREE.CubeCamera(0.1, 900, cubeTarget);
      try {
        scene.environment = null; // prevents reflective surfaces from sampling the probe being captured
        renderer.xr.enabled = false;
        renderer.shadowMap.autoUpdate = false;
        renderer.autoClear = true;
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        scene.traverse((object) => {
          if (
            object.userData.excludeFromReflectionProbe ||
            object.userData.skipBake ||
            object.userData.isRacer ||
            object.userData.isParticle
          ) {
            hidden.push([object, object.visible]);
            object.visible = false;
          }
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if (!material?.envMap) continue;
            environmentMaterials.push([material, material.envMap]);
            material.envMap = null;
            material.needsUpdate = true;
          }
        });
        for (const candidate of candidates) {
          const section = candidate.section;
          const t = (section.start + section.end) * 0.5;
          const pose = track.poseAt(t * track.TRACK, 0, 0);
          const point = pose.p?.clone?.() || new THREE.Vector3(...pose.p);
          point.add(new THREE.Vector3(0, candidate.enclosed ? 4.5 : 20, 0));
          cubeCamera.position.copy(point);
          cubeCamera.update(renderer, scene);
          const target = generator.fromCubemap(cubeTarget.texture);
          fresh.push({
            sectionId: section.id,
            enclosed: candidate.enclosed,
            position: point,
            texture: target.texture,
            target,
          });
        }
      } catch (error) {
        fresh.forEach((probe) => probe.target.dispose());
        throw error;
      } finally {
        for (const [object, visible] of hidden) object.visible = visible;
        for (const [material, envMap] of environmentMaterials) {
          material.envMap = envMap;
          material.needsUpdate = true;
        }
        scene.environment = previousEnvironment;
        scene.background = previousBackground;
        renderer.setRenderTarget(previousTarget);
        renderer.xr.enabled = previousXr;
        renderer.shadowMap.autoUpdate = previousShadowAuto;
        renderer.toneMapping = previousToneMapping;
        renderer.outputColorSpace = previousColorSpace;
        renderer.toneMappingExposure = previousExposure;
        renderer.autoClear = previousAutoClear;
        renderer.shadowMap.enabled = previousShadowEnabled;
        renderer.setClearColor(previousClearColor, previousClearAlpha);
        renderer.setViewport(previousViewport);
        renderer.setScissor(previousScissor);
        renderer.setScissorTest(previousScissorTest);
        cubeTarget.dispose();
      }
      for (const probe of probes) probe.target.dispose();
      probes.splice(0, probes.length, ...fresh);
      captureCount++;
      environments.exterior =
        probes.find((probe) => !probe.enclosed)?.texture || environments.exterior;
      environments.interior =
        probes.find((probe) => probe.enclosed)?.texture || environments.interior;
      return probes.length;
    },
    forPosition(position, section) {
      const enclosedSection = section && probeEnclosed(section);
      if (!probes.length) return enclosedSection ? environments.interior : environments.exterior;
      let candidates = probes.filter((probe) => probe.enclosed === !!enclosedSection);
      if (!candidates.length) candidates = probes;
      let selected = candidates[0];
      let distance = Infinity;
      for (const probe of candidates) {
        const next = probe.position.distanceToSquared(position);
        if (next < distance) {
          distance = next;
          selected = probe;
        }
      }
      return selected.texture;
    },
    get captureCount() {
      return captureCount;
    },
    dispose() {
      for (const probe of probes) probe.target.dispose();
      probes.length = 0;
      targets.forEach((target) => target.dispose());
      generator.dispose();
    },
  };
  return environments;
}
