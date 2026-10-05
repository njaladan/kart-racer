import * as THREE from "../../vendor/three/three.module.js";

// Assets are local at runtime. Failed optional downloads fall back to the
// game's procedural artwork, so an unavailable texture cannot stop a race.
export async function loadGraphicsAssets(renderer) {
  const loader = new THREE.TextureLoader();
  const texture = async (name) => {
    try {
      const t = await loader.loadAsync(`./assets/${name}.webp`);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      return t;
    } catch (error) {
      console.warn(`Using procedural fallback for ${name}`, error);
      return null;
    }
  };
  const models = async () => {
    try {
      const responses = await Promise.all([
        fetch("./assets/nature.json"),
        fetch("./assets/nature.bin"),
      ]);
      if (responses.some((r) => !r.ok)) throw new Error("Nature asset request failed");
      const [manifest, buffer] = await Promise.all([
        responses[0].json(),
        responses[1].arrayBuffer(),
      ]);
      return manifest.models.map((model) => {
        const data = new THREE.InterleavedBuffer(
          new Float32Array(buffer, model.offset, model.vertices * manifest.stride),
          manifest.stride,
        );
        const g = new THREE.BufferGeometry();
        g.name = model.name;
        g.setAttribute("position", new THREE.InterleavedBufferAttribute(data, 3, 0));
        g.setAttribute("normal", new THREE.InterleavedBufferAttribute(data, 3, 3));
        g.setAttribute("color", new THREE.InterleavedBufferAttribute(data, 3, 6));
        g.computeBoundingBox();
        g.computeBoundingSphere();
        return g;
      });
    } catch (error) {
      console.warn("Using procedural scenery fallback", error);
      return null;
    }
  };
  const [grass, asphalt, nature] = await Promise.all([
    texture("grass"),
    texture("asphalt"),
    models(),
  ]);
  return { grass, asphalt, nature, environment: null };
}
