import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useUIStore } from "@/store/ui-store";

export function CameraMonitor() {
  const lastCheckRef = useRef(0);
  const startTimeRef = useRef(0);
  useFrame(({ camera }) => {
    // Record mount time on first frame
    if (startTimeRef.current === 0) startTimeRef.current = Date.now();
    // Skip first 3 seconds to let simulation settle
    if (Date.now() - startTimeRef.current < 3000) return;
    const now = Date.now();
    if (now - lastCheckRef.current < 300) return;
    lastCheckRef.current = now;
    const p = camera.position;
    useUIStore.getState().setCameraMoved(
      Math.abs(p.x) > 30 || Math.abs(p.y) > 30 || Math.abs(p.z - 500) > 50,
    );
  });
  return null;
}
