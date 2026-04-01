import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";

// ── Avatar texture loader ──

const avatarLoader = new THREE.TextureLoader();
avatarLoader.crossOrigin = "anonymous";

export function AvatarSphere({
  radius,
  color,
  pictureUrl,
}: {
  radius: number;
  color: string;
  pictureUrl?: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const threeColor = useMemo(() => new THREE.Color(color), [color]);
  // Brighter emissive for fallback so avatar sphere is visible without lighting
  const emissiveColor = useMemo(
    () => new THREE.Color(color).multiplyScalar(0.4),
    [color],
  );

  // Load avatar texture asynchronously, swap material on success
  useEffect(() => {
    if (!pictureUrl) return;
    avatarLoader.load(
      pictureUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        if (meshRef.current) {
          meshRef.current.material = new THREE.MeshBasicMaterial({ map: tex });
        }
      },
      undefined,
      () => {},
    );
  }, [pictureUrl]);

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 32, 32]} />
      <meshStandardMaterial
        color={threeColor}
        emissive={emissiveColor}
        emissiveIntensity={1.5}
        transparent
        opacity={0.95}
        roughness={0.3}
        metalness={0.1}
      />
    </mesh>
  );
}
