import { useMemo } from "react";
import * as THREE from "three";

// 共享光晕：程序生成的径向渐变贴图（64×64 Canvas，离线自给）+ Sprite 封装。
// 用途：灯罩外的柔光晕。之前的做法是一颗低透明度的加色球——多边形轮廓近看即穿帮，
// 且没有"光在空气里散开"的衰减曲线；Sprite 永远面向相机 + 渐变贴图没有轮廓可言。

let cached: THREE.Texture | null = null;

/** 径向渐变光晕贴图（模块级缓存，一次生成全场共用）。 */
export function glowTexture(): THREE.Texture {
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.22, "rgba(255,255,255,0.5)");
  g.addColorStop(0.55, "rgba(255,255,255,0.14)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cached = tex;
  return tex;
}

/** 一团柔光（加色、不写深度、不受色调映射）。scale 是世界尺寸（米）。 */
export function GlowSprite({
  position,
  color,
  scale = 1,
  opacity = 0.3,
}: {
  position: [number, number, number];
  color: string;
  scale?: number;
  opacity?: number;
}) {
  const mat = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: new THREE.Color(color),
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [color, opacity],
  );
  return <sprite position={position} scale={[scale, scale, 1]} material={mat} />;
}
