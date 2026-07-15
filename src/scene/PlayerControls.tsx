import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld } from "../store/useWorld";
import { interactableObjs, zoneIdOf } from "./interactables";
import { spawnRipple } from "./ripples";
import { useWalkInput } from "./input";
import { computeFocusPoseClear, dampPose } from "./cameraDirector";
import { syncAudioListener } from "./audioListener";
import { SCENE_DATA, resolveScene } from "../scenes/registryData";
// 望远镜"看记忆"是 loft 专有舞台件——仅在 telescopeActive（只可能在 loft 置真）时读这些常量。
import { TELESCOPE, TELESCOPE_ID, TELESCOPE_ROT_Y, TELE_EYEPIECE_LOCAL, TELE_OBJECTIVE_LOCAL } from "../theme";

// 第一人称控制器：帧循环状态机（顺序即优先级）——
//   聚焦进/出检测 → ① 入场前环绕 → ② 入场电影 → ③ 聚焦定格 → ④ 退出回程 → ⑤ 漫游。
// 输入接线在 input.ts；聚焦取景/阻尼在 cameraDirector.ts；听者同步在 audioListener.ts；
// 碰撞/支撑在 walk.ts（纯函数）。此处只剩编排与漫游本体。

const SPEED = 4.3; // 漫游步速
const REACH = 7.0; // 可交互距离：近到这个范围内准心才亮、才能按 ENTER 进入
const AIM_FAR = 24.0; // 准心命中检测距离：更远也先报出对准了什么（远处只提示名字）
const CENTER = new THREE.Vector2(0, 0);
const INTRO_DUR = 6.4; // 入场电影时长（秒）——更从容的落定
const ACCEL_RATE = 9; // 起步加速度（指数逼近速率）：~0.25s 到满速——身体有重量，不是开关
const DECEL_RATE = 12; // 停步减速度：略快于起步，松键即稳，不"滑冰"
const FOV_BASE = 58;
const FOV_RUN = 2.6; // 满速时视野加宽量（度）：速度感的下意识信号，克制到不被明确察觉

export default function PlayerControls() {
  const { camera, gl, clock, scene } = useThree();
  const focusZone = useWorld((s) => s.focusZone);
  const openTelescope = useWorld((s) => s.openTelescope);

  // 当前场景数据（出生点/视高/行走求解器/锚点/聚焦/是否有水）——经注册表取，不再直接 import theme。
  // 切场景时 style 变 → sceneData 变；hot loop 里的闭包每帧取最新 render 的 sceneData。
  const style = useWorld((s) => s.world.room.style);
  const sceneData = SCENE_DATA[resolveScene(style)];

  const feet = useRef(new THREE.Vector3(sceneData.spawn.position[0], 0, sceneData.spawn.position[2]));
  const vel = useRef(new THREE.Vector2(0, 0)); // 水平速度（惯性状态）：起步/停步有质量感
  const bobAmp = useRef(0); // 步伐幅度包络（走↔停平滑过渡，不硬切）
  const bob = useRef(0);
  const rippleAccum = useRef(0);
  const rayAccum = useRef(0);
  const introStart = useRef<number | null>(null);
  const introDone = useRef(false);
  const introRipple = useRef(false);
  const introRipple2 = useRef(false);
  const introFrom = useRef(new THREE.Vector3());
  const hoveredRef = useRef<string | null>(null);
  const reachRef = useRef(false);
  const snapshot = useRef<{ x: number; y: number; z: number; yaw: number; pitch: number } | null>(null);
  const exitActive = useRef(false);
  const exitAccum = useRef(0); // 退出缓动累计时长（超时兜底交还控制）
  const prevFocused = useRef<string | null>(null); // 帧内检测聚焦进/出（消除 effect 竞态）
  const initedStyle = useRef<string | null>(null); // 已按哪个场景初始化过出生点（帧内判定，消除 effect 竞态）

  // 指针锁定下按主键：准心命中且够得着 → 望远镜进"看记忆"，功能区进聚焦。
  const { yaw, pitch, keys, joy } = useWalkInput(gl.domElement, () => {
    if (!hoveredRef.current || !reachRef.current) return;
    if (hoveredRef.current === TELESCOPE_ID) openTelescope();
    else focusZone(hoveredRef.current);
  });

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const sightRay = useMemo(() => new THREE.Raycaster(), []); // 聚焦避障专用（别和准心 ray 抢 far 配置）
  const sightDir = useMemo(() => new THREE.Vector3(), []);
  const center = useMemo(() => new THREE.Vector3(), []);
  const focusGoal = useMemo(() => new THREE.Vector3(), []);
  const focusGoalQ = useMemo(() => new THREE.Quaternion(), []);
  const exitPos = useMemo(() => new THREE.Vector3(), []);
  const exitQ = useMemo(() => new THREE.Quaternion(), []);
  const tmpEuler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);
  // 望远镜"看记忆"机位（凑到目镜后、望向物镜/夜空）。一次算好、每帧阻尼飞入。
  const teleGoal = useMemo(() => new THREE.Vector3(), []);
  const teleGoalQ = useMemo(() => new THREE.Quaternion(), []);
  const upVec = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const prevTele = useRef(false);

  useEffect(() => {
    camera.rotation.order = "YXZ";
  }, [camera]);

  // 首帧 / 切场景的出生点初始化改到帧循环里（见 useFrame 顶部的 initedStyle 守卫）：
  // 用帧内读到的 live 场景数据判定，而不是 React effect——effect 的时序在"直接启动即 attic"时
  // 会漏掉出生点初始化（玩家曾停在 loft 旧坐标、门厅界外悬空）。loft 直接启动行为不变。

  // 聚焦进/出由帧循环检测调用（不放 effect——effect 晚一帧会让漫游分支先把相机跳回脚步位，
  // 那正是"退出没有动画"的根因）。这里只算好目标位姿/快照，实际缓动在帧里做。
  const beginFocus = useCallback((id: string) => {
    snapshot.current = { x: feet.current.x, y: feet.current.y, z: feet.current.z, yaw: yaw.current, pitch: pitch.current };
    document.exitPointerLock?.();

    // 锚点按 zone.type 解析（id 是用户数据，导入的世界可改名）；查无此区回退持久化 zone.position。
    // 取"当前场景"的聚焦数据（live 读 getState，避免闭包里拿到旧场景的锚点）。
    const st = useWorld.getState();
    const sd = SCENE_DATA[resolveScene(st.world.room.style)];
    const zone = st.world.zones.find((z) => z.id === id);
    const f = zone ? sd.focus[zone.type] : undefined;
    const a = zone ? sd.zoneAnchors[zone.type] : undefined;
    const p = zone?.position;
    center.set(
      f ? f.center[0] : a ? a.position[0] : p ? p[0] : 0,
      f ? f.center[1] : a ? a.position[1] : p ? p[1] : 1.4,
      f ? f.center[2] : a ? a.position[2] : p ? p[2] : 0,
    );
    const radius = f ? f.radius : 1.6;
    // 避障：候选机位 → 球心 视线上不许有投影级实体（灯杆/书架/栏杆都 castShadow；
    // 水面/天空/雾/光柱这些氛围件都不投影，天然被排除）。审计 F3：曾被落地灯整根挡镜。
    const occluders: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.castShadow) occluders.push(o);
    });
    const isClear = (pos: THREE.Vector3) => {
      sightDir.copy(center).sub(pos);
      const d = sightDir.length();
      sightRay.set(pos, sightDir.normalize());
      sightRay.near = 0.01;
      sightRay.far = Math.max(0.1, d - radius * 0.8); // 主体自身不算遮挡
      return sightRay.intersectObjects(occluders, false).length === 0;
    };
    computeFocusPoseClear(camera as THREE.PerspectiveCamera, center, radius, isClear, focusGoal, focusGoalQ);
    exitActive.current = false;
  }, [camera, center, focusGoal, focusGoalQ, yaw, pitch, scene, sightRay, sightDir]);

  const beginExit = useCallback(() => {
    if (!snapshot.current) return;
    exitAccum.current = 0;
    exitActive.current = true;
  }, []);

  // 凑到望远镜目镜后一点、望向物镜（沿镜轴望进夜空）。目镜/物镜局部点由 theme 常量给，
  // 施加望远镜的世界位置 + 绕 Y 旋转还原到世界坐标。
  const beginTelescope = useCallback(() => {
    snapshot.current = { x: feet.current.x, y: feet.current.y, z: feet.current.z, yaw: yaw.current, pitch: pitch.current };
    document.exitPointerLock?.();
    const cyR = Math.cos(TELESCOPE_ROT_Y), syR = Math.sin(TELESCOPE_ROT_Y);
    const worldOf = (l: readonly [number, number, number]) =>
      new THREE.Vector3(TELESCOPE[0] + l[0] * cyR + l[2] * syR, TELESCOPE[1] + l[1], TELESCOPE[2] - l[0] * syR + l[2] * cyR);
    const eyepiece = worldOf(TELE_EYEPIECE_LOCAL);
    const objective = worldOf(TELE_OBJECTIVE_LOCAL);
    const outDir = eyepiece.clone().sub(objective).normalize(); // 目镜朝外（来客侧）
    teleGoal.copy(eyepiece).addScaledVector(outDir, 0.14);
    teleGoal.y += 0.03;
    const look = eyepiece.clone().addScaledVector(objective.clone().sub(eyepiece), 3.0); // 沿镜轴望进夜空
    const m = new THREE.Matrix4().lookAt(teleGoal, look, upVec);
    teleGoalQ.setFromRotationMatrix(m);
    exitActive.current = false;
  }, [teleGoal, teleGoalQ, upVec, yaw, pitch]);

  useFrame((_state, dtRaw) => {
    // 仅开发期：__freecam 置位时不写相机（供无头验证从任意机位渲染并经后处理）。
    if (import.meta.env.DEV && (window as unknown as { __freecam?: boolean }).__freecam) return;
    const dt = Math.min(dtRaw, 0.05);
    const s = useWorld.getState();
    // live 场景数据（与 s 同源，切场景当帧即一致）：出生点/视高/行走求解器/是否有水。
    const sd = SCENE_DATA[resolveScene(s.world.room.style)];
    const spawn = sd.spawn.position;

    // ── 首帧 / 切场景：把玩家瞬移到"当前场景"的出生点（用 live sd 判定，race-proof）──
    //   直接启动即 attic 时，effect 版会漏掉初始化 → 玩家停在 loft 旧坐标悬空；这里首帧即按场景落位。
    //   loft 直接启动：首帧 initedStyle=null≠"loft" 同样瞬移到 loft 出生点，行为不变。
    if (initedStyle.current !== sd.style) {
      initedStyle.current = sd.style;
      const [ix, , iz] = spawn;
      feet.current.set(ix, sd.walk(0, ix, iz, ix, iz).y, iz);
      yaw.current = sd.spawn.yaw;
      pitch.current = -0.04;
      vel.current.set(0, 0);
      bobAmp.current = 0;
    }

    // ── 聚焦进/出转场：帧内检测（在一切分支之前），消除 effect 晚一帧导致的"直接跳转" ──
    if (s.focusedZoneId !== prevFocused.current) {
      if (s.focusedZoneId) beginFocus(s.focusedZoneId);
      else beginExit();
      prevFocused.current = s.focusedZoneId;
    }
    // 望远镜"看记忆"进/出：与聚焦同构（开→飞向目镜，关→beginExit 飞回漫游位姿）。
    if (s.telescopeActive !== prevTele.current) {
      if (s.telescopeActive) beginTelescope();
      else beginExit();
      prevTele.current = s.telescopeActive;
    }

    // ── ① 入场前：缓慢电影感环绕，俯瞰漂在星海上的整座回廊 ──
    if (!s.entered) {
      const t = clock.elapsedTime;
      camera.position.set(Math.sin(t * 0.06) * 3.0, 3.7 + Math.sin(t * 0.12) * 0.2, 10.6 + Math.cos(t * 0.06) * 1.0);
      camera.lookAt(Math.sin(t * 0.06) * 0.5, 0.9, -3.0);
      return;
    }

    // ── ② 入场电影（点「进入」后约 5.5 秒）：从环绕机位缓缓沉到水面眼平，落在出生点，再交还控制 ──
    if (!introDone.current && !s.focusedZoneId) {
      if (introStart.current === null) {
        introStart.current = clock.elapsedTime;
        introFrom.current.copy(camera.position);
      }
      const e = clock.elapsedTime - introStart.current;
      if (e < INTRO_DUR) {
        const x = Math.min(1, e / INTRO_DUR);
        const k = x * x * x * (x * (x * 6 - 15) + 10); // smootherstep
        // 掠过水面再落定：中途把相机压到近水面（sin(πx) 峰在半程），像滑翔着贴上星海、
        // 再缓缓抬到眼平——比直线下降多一个"掠水"的拍点（仅有水场景，避免非水场景穿地）。
        const dip = sd.water ? 0.62 * Math.sin(Math.PI * x) : 0;
        camera.position.set(
          THREE.MathUtils.lerp(introFrom.current.x, spawn[0], k),
          THREE.MathUtils.lerp(introFrom.current.y, sd.eye, k) + Math.sin(e * 0.6) * 0.04 - dip,
          THREE.MathUtils.lerp(introFrom.current.z, spawn[2], k),
        );
        // 视线从"环视整座回廊"缓缓落到"眼前要走的路"。
        camera.lookAt(0, THREE.MathUtils.lerp(1.35, 1.05, k), THREE.MathUtils.lerp(-5.4, -3.4, k));
        // 掠水拍点：半程压到最低时荡开第一圈涟漪——"原来我贴着星海滑进来"（仅有水场景）。
        if (sd.water && !introRipple.current && x > 0.5) {
          introRipple.current = true;
          spawnRipple(spawn[0], spawn[2], clock.elapsedTime, 1.4);
        }
        // 落定拍点：尾程站稳时再荡开一圈更柔的涟漪，作为"落脚"的收束。
        if (sd.water && !introRipple2.current && x > 0.9) {
          introRipple2.current = true;
          spawnRipple(spawn[0], spawn[2], clock.elapsedTime, 0.9);
        }
        syncAudioListener(camera);
        return;
      }
      // 收尾：对齐漫游状态到落点，交还控制
      introDone.current = true;
      feet.current.set(spawn[0], 0, spawn[2]);
      yaw.current = sd.spawn.yaw;
      pitch.current = -0.04;
    }

    // ── ③ 聚焦某功能区：指数阻尼飞入并定格（目标由 beginFocus 一次算好）──
    if (s.focusedZoneId) {
      dampPose(camera, focusGoal, focusGoalQ, dt);
      syncAudioListener(camera);
      return;
    }

    // ── ③' 望远镜"看记忆"：阻尼飞到目镜后、望向夜空并定格（目标由 beginTelescope 算好）──
    if (s.telescopeActive) {
      dampPose(camera, teleGoal, teleGoalQ, dt);
      syncAudioListener(camera);
      return;
    }

    // ── ④ 退出聚焦：指数阻尼飞回漫游位姿，到位（或超时兜底）再交还控制 ──
    if (exitActive.current && snapshot.current) {
      exitPos.set(snapshot.current.x, snapshot.current.y + sd.eye, snapshot.current.z);
      tmpEuler.set(snapshot.current.pitch, snapshot.current.yaw, 0);
      exitQ.setFromEuler(tmpEuler);
      dampPose(camera, exitPos, exitQ, dt);
      syncAudioListener(camera);
      exitAccum.current += dt;
      if (camera.position.distanceTo(exitPos) < 0.03 || exitAccum.current > 1.4) {
        feet.current.set(snapshot.current.x, snapshot.current.y, snapshot.current.z);
        yaw.current = snapshot.current.yaw;
        pitch.current = snapshot.current.pitch;
        snapshot.current = null;
        exitActive.current = false;
      }
      return;
    }

    // ── ⑤ 漫游 ──
    const k = keys.current;
    const fIn = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) - joy.current.y;
    const sIn = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0) + joy.current.x;
    const th = yaw.current;
    let mx = -Math.sin(th) * fIn + Math.cos(th) * sIn;
    let mz = -Math.cos(th) * fIn - Math.sin(th) * sIn;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const speed = SPEED * (k.has("ShiftLeft") ? 1.7 : 1);

    // ── 惯性：速度向目标指数逼近（起步 ~0.25s 到满速、停步略快）。身体有质量，
    //    松键不再立停、起步不再瞬满——"丝滑"来自加减速曲线，不是更快的响应。 ──
    const targetVx = mx * speed;
    const targetVz = mz * speed;
    const rate = len > 0.001 ? ACCEL_RATE : DECEL_RATE;
    const kk = 1 - Math.exp(-rate * dt);
    vel.current.x += (targetVx - vel.current.x) * kk;
    vel.current.y += (targetVz - vel.current.y) * kk;
    const speedNow = Math.hypot(vel.current.x, vel.current.y);
    const moving = speedNow > 0.15;

    const res = sd.walk(
      feet.current.y,
      feet.current.x,
      feet.current.z,
      feet.current.x + vel.current.x * dt,
      feet.current.z + vel.current.y * dt,
    );
    // 水平：直接采用求解后的合法落点（不 damp 去"追逐被夹目标"——那种追逐在低帧时会
    // "走进去一半又被拉回"，空气墙弹回感）。每帧位移本就很小，1:1 即顺滑。
    // 被墙挡住时把速度同步回实际位移，撞墙后松键不会"憋着劲"再冲一下。
    if (dt > 1e-4) {
      vel.current.x = (res.x - feet.current.x) / dt;
      vel.current.y = (res.z - feet.current.z) / dt;
    }
    feet.current.x = res.x;
    feet.current.z = res.z;
    feet.current.y = THREE.MathUtils.damp(feet.current.y, res.y, 12, dt); // 高度仍平滑（上下坡道）

    // ── 步伐：幅度包络随"是否在走"平滑起落（不硬切）；纵向起伏 + 极轻的横向摇 ──
    bobAmp.current = THREE.MathUtils.damp(bobAmp.current, moving ? Math.min(1, speedNow / SPEED) : 0, 8, dt);
    bob.current += dt * speedNow * 2.2;
    const headbob = Math.sin(bob.current) * 0.02 * bobAmp.current;
    const sway = Math.cos(bob.current * 0.5) * 0.008 * bobAmp.current;

    // ── FOV 随速度微张（满速 +2.6°，指数阻尼）：速度感的下意识信号 ──
    const cam = camera as THREE.PerspectiveCamera;
    const fovGoal = FOV_BASE + FOV_RUN * Math.min(1.2, speedNow / SPEED);
    if (Math.abs(cam.fov - fovGoal) > 0.01) {
      cam.fov = THREE.MathUtils.damp(cam.fov, fovGoal, 6, dt);
      cam.updateProjectionMatrix();
    }

    // 脚步涟漪：走在水面（脚下高度≈0）时，每跨过一步距离就在星海倒影上荡开一圈。
    // 1.2 单位一圈 ≈ 3.6/秒：慢于环形缓冲的覆盖速度，扩散中的环能完整放完（否则看着"抽搐"）。
    if (sd.water && moving && feet.current.y < 0.18) {
      rippleAccum.current += speedNow * dt;
      if (rippleAccum.current > 1.2) {
        rippleAccum.current = 0;
        spawnRipple(feet.current.x, feet.current.z, clock.elapsedTime, 0.95);
      }
    }

    // 相机坐落在脚步上；转头/俯仰仍 1:1 即时（加平滑=黄油感延迟，不做）。
    // 横向摇以"肩部小平移"实现（沿相机右向），比 roll 倾斜更不晕。
    camera.position.set(feet.current.x, feet.current.y + sd.eye + headbob, feet.current.z);
    camera.rotation.set(pitch.current, yaw.current, 0);
    if (bobAmp.current > 0.01) {
      camera.position.x += Math.cos(yaw.current) * sway;
      camera.position.z -= Math.sin(yaw.current) * sway;
    }

    // 准心命中检测 → 悬停提示。节流到 ~11Hz：每帧递归 raycast + zustand 写会带动 HUD 重渲染。
    rayAccum.current += dt;
    if (rayAccum.current >= 0.09) {
      rayAccum.current = 0;
      raycaster.far = AIM_FAR; // 远距离也先命中：好让准心报出"你正看着什么"
      raycaster.setFromCamera(CENTER, camera);
      const hits = interactableObjs.length ? raycaster.intersectObjects(interactableObjs, true) : [];
      const id = hits.length ? zoneIdOf(hits[0].object) : null;
      const inReach = hits.length > 0 && hits[0].distance <= REACH; // 近到可交互距离才算"够得着"
      if (id !== hoveredRef.current || inReach !== reachRef.current) {
        hoveredRef.current = id;
        reachRef.current = inReach;
        s.setHovered(id, inReach);
      }
    }

    syncAudioListener(camera);
  });

  return null;
}
