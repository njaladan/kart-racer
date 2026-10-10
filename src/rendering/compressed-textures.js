import * as THREE from "../../vendor/three/three.module.js";
import { KTX2Loader } from "../../vendor/three/addons/loaders/KTX2Loader.js";

const manifestUrl = "./assets/compressed-textures.json";
const loaderByRenderer = new WeakMap();
let manifestPromise;

function normalizedAssetPath(url) {
  const raw = String(url);
  try {
    const parsed = new URL(raw, globalThis.location?.href || "http://localhost/");
    const pathname = decodeURIComponent(parsed.pathname).replace(/^\/+/, "");
    const marker = pathname.indexOf("assets/");
    return marker >= 0 ? pathname.slice(marker) : pathname;
  } catch {
    return raw.replace(/^\.\//, "").replace(/^\/+/, "").split(/[?#]/, 1)[0];
  }
}

function readManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(manifestUrl)
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
  }
  return manifestPromise;
}

/** Selects the KTX2 URL for a bundled source URL, or returns the original URL. */
export function chooseCompressedUrl(url, manifest) {
  const entry = manifest?.textures?.[normalizedAssetPath(url)];
  return entry?.file || url;
}

/**
 * Returns a renderer-ready KTX2 loader after GPU format support is detected.
 * KTX2 transcoding is skipped on unsupported or non-browser renderers.
 */
export function getCompressedTextureLoader(renderer) {
  if (!renderer || typeof renderer !== "object") return null;
  if (loaderByRenderer.has(renderer)) return loaderByRenderer.get(renderer);
  try {
    const loader = new KTX2Loader();
    loader.setTranscoderPath("./vendor/three/addons/libs/basis/");
    loader.detectSupport(renderer);
    loaderByRenderer.set(renderer, loader);
    return loader;
  } catch {
    loaderByRenderer.set(renderer, null);
    return null;
  }
}

/**
 * Loads a bundled compressed map when supported and falls back to its source
 * image for unsupported GPUs, missing manifests, or failed transcoding.
 */
export async function loadCompressedTexture(renderer, url, options = {}) {
  const {
    colorSpace = THREE.NoColorSpace,
    wrap = THREE.RepeatWrapping,
    anisotropy = 8,
    textureLoader = new THREE.TextureLoader(),
  } = options;
  const manifest = await readManifest();
  const compressedUrl = chooseCompressedUrl(url, manifest);
  const compressedLoader = compressedUrl !== url ? getCompressedTextureLoader(renderer) : null;
  let texture;
  if (compressedLoader) {
    try {
      texture = await compressedLoader.loadAsync(compressedUrl);
    } catch {
      // The original WebP remains the compatibility path if a device rejects KTX2.
    }
  }
  if (!texture) texture = await textureLoader.loadAsync(url);
  texture.colorSpace = colorSpace;
  texture.wrapS = texture.wrapT = wrap;
  const maxAnisotropy = renderer?.getMaxAnisotropy?.() ?? 1;
  texture.anisotropy = Math.max(1, Math.min(anisotropy, maxAnisotropy));
  texture.generateMipmaps = texture.mipmaps?.length ? false : true;
  texture.needsUpdate = true;
  return texture;
}

/** Clears the cached manifest and renderer loader state, primarily for hot reload. */
export function resetCompressedTextureState() {
  manifestPromise = undefined;
}
