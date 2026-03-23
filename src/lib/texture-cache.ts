import * as THREE from "three";

const cache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();
loader.crossOrigin = "anonymous";

const pending = new Map<string, Promise<THREE.Texture>>();

export function loadAvatarTexture(url: string): Promise<THREE.Texture> {
  const cached = cache.get(url);
  if (cached) return Promise.resolve(cached);

  const inflight = pending.get(url);
  if (inflight) return inflight;

  const promise = new Promise<THREE.Texture>((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        cache.set(url, tex);
        pending.delete(url);
        resolve(tex);
      },
      undefined,
      (err) => {
        pending.delete(url);
        reject(err);
      },
    );
  });

  pending.set(url, promise);
  return promise;
}

export function getCachedTexture(url: string): THREE.Texture | undefined {
  return cache.get(url);
}

export function preloadAvatars(urls: string[], maxConcurrent = 6): void {
  let i = 0;
  function next() {
    if (i >= urls.length) return;
    const url = urls[i++];
    loadAvatarTexture(url).catch(() => {}).finally(next);
  }
  for (let j = 0; j < Math.min(maxConcurrent, urls.length); j++) {
    next();
  }
}
