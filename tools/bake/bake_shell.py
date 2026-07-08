# 分灯 lightmap 烘焙（My Room in 3D 技法的本仓库变体）：
#   输入  tools/bake/work/shell.glb（devExport 从活场景导出：static__/emitter__/occluder__ 前缀）
#         tools/bake/work/lights.json（活场景全部灯光序列化）
#   输出  <out>/shell-baked.glb（静态壳合并体，UVMap + Lightmap 双 UV）
#         <out>/shell-lightmap.png（R=暖灯间接光 G=月光间接光 B=天光全量，各通道无色辐照度，sqrt 编码）
#         <out>/shell-lightmap.json（各通道解码 scale，运行时乘回）
#
# 通道语义（与运行时实时光解耦，绝不双计）：
#   R 暖灯组：点光 INDIRECT + 自发光罩 DIRECT+INDIRECT（实时端点光直射保留、面光源本就不存在）
#   G 月光组：太阳 INDIRECT（实时端月光直射+阴影保留）
#   B 天光组：世界穹顶 DIRECT+INDIRECT（≈带遮蔽的环境光，兼任 aoMap 数据）
#
# 用法：blender --background --python tools/bake/bake_shell.py -- <work_dir> <out_dir> [res] [samples]
import bpy
import sys
import os
import json
import math
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
WORK = os.path.abspath(argv[0])
OUT = os.path.abspath(argv[1])
RES = int(argv[2]) if len(argv) > 2 else 2048
SAMPLES = int(argv[3]) if len(argv) > 3 else 384
PT_SCALE = 10.0  # three candela -> blender watts（组内一致即可，绝对值由运行时 uniform 定）
SUN_STRENGTH = 3.0  # 月光 sun 强度（W/m²）
EMIT_SCALE = 3.0  # 自发光罩相对点光的补偿（罩面积小，glTF 强度直读偏弱）
SKY_COLOR = (0.13, 0.19, 0.35)  # 夜天光（hemi sky #33477e 邻域）
SKY_STRENGTH = 1.0
os.makedirs(OUT, exist_ok=True)


def log(*a):
    print("[shell]", *a, flush=True)


def setup_gpu(scene):
    scene.render.engine = "CYCLES"
    scene.cycles.samples = SAMPLES
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for dev_type in ("OPTIX", "CUDA"):
            try:
                prefs.compute_device_type = dev_type
                prefs.get_devices()
                if any(d.type != "CPU" for d in prefs.devices):
                    for d in prefs.devices:
                        d.use = d.type != "CPU"
                    scene.cycles.device = "GPU"
                    log(f"GPU via {dev_type}")
                    return
            except Exception as e:  # noqa: BLE001
                log(f"{dev_type} unavailable: {e}")
    except Exception as e:  # noqa: BLE001
        log(f"cycles prefs unavailable: {e}")
    scene.cycles.device = "CPU"
    log("CPU fallback")


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4))


bpy.ops.wm.read_homefile(use_empty=True)
scene = bpy.context.scene
setup_gpu(scene)

bpy.ops.import_scene.gltf(filepath=os.path.join(WORK, "shell.glb"))

statics, emitters, occluders = [], [], []
for o in list(bpy.data.objects):
    if o.type != "MESH":
        continue
    if o.name.startswith("static__"):
        statics.append(o)
    elif o.name.startswith("emitter__"):
        emitters.append(o)
    elif o.name.startswith("occluder__"):
        occluders.append(o)
log(f"statics={len(statics)} emitters={len(emitters)} occluders={len(occluders)}")
assert statics, "no static meshes"

# ── 静态壳：拍平 → 特例处理 → 合并 ────────────────────────────────────────────
bpy.ops.object.select_all(action="DESELECT")
for o in statics:
    o.select_set(True)
bpy.context.view_layer.objects.active = statics[0]
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.make_single_user(object=True, obdata=True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# 书墙背板：three 里是外向法线圆柱、内面靠 DoubleSide 显示——烘焙以法线定"正面"，
# 不翻则贴图记录的是朝外（没人看）那一面的光。翻成内向，让烘焙面=可见面。
for o in statics:
    if "wall-back" in o.name:
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.flip_normals()
        bpy.ops.object.mode_set(mode="OBJECT")
        log(f"flipped normals: {o.name}")

# 统一 UV 层（坡道等自定义几何没有 UV，join 前补齐同名层避免错位）
for o in statics:
    if not o.data.uv_layers:
        o.data.uv_layers.new(name="UVMap")
    else:
        o.data.uv_layers[0].name = "UVMap"

bpy.ops.object.select_all(action="DESELECT")
for o in statics:
    o.select_set(True)
bpy.context.view_layer.objects.active = statics[0]
bpy.ops.object.join()
shell = bpy.context.view_layer.objects.active
shell.name = "Shell"
log(f"joined shell: {len(shell.data.polygons)} tris-ish, {len(shell.data.materials)} materials")

# Lightmap UV（第二层，atlas）
lm_layer = shell.data.uv_layers.new(name="Lightmap")
shell.data.uv_layers.active = lm_layer
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.0015)
bpy.ops.object.mode_set(mode="OBJECT")

# ── 镜面水（y=0 的黑镜，给低角度弹射与天光反射）─────────────────────────────
bpy.ops.mesh.primitive_plane_add(size=90, location=(0, 0, 0))
water = bpy.context.view_layer.objects.active
water.name = "WaterMirror"
wmat = bpy.data.materials.new("watermirror")
wmat.use_nodes = True
bsdf = wmat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.05, 0.07, 0.12, 1.0)
bsdf.inputs["Metallic"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.15
water.data.materials.append(wmat)

# ── 灯光：lights.json → Blender ───────────────────────────────────────────────
with open(os.path.join(WORK, "lights.json"), encoding="utf-8") as f:
    lights = json.load(f)

point_objs, sun_objs = [], []
for i, L in enumerate(lights):
    if L.get("skip"):
        log(f"skip content light: {L['kind']} {L.get('pos')}")
        continue
    if L["kind"] == "point":
        data = bpy.data.lights.new(f"pt{i}", type="POINT")
        data.color = hex_to_rgb(L["color"])
        data.energy = float(L["intensity"]) * PT_SCALE
        data.shadow_soft_size = 0.07
        ob = bpy.data.objects.new(f"pt{i}", data)
        ob.location = Vector(L["pos"])
        scene.collection.objects.link(ob)
        point_objs.append(ob)
    elif L["kind"] == "dir":
        data = bpy.data.lights.new(f"sun{i}", type="SUN")
        data.color = hex_to_rgb(L["color"])
        data.energy = SUN_STRENGTH * float(L["intensity"])
        data.angle = math.radians(2.0)
        ob = bpy.data.objects.new(f"sun{i}", data)
        d = -Vector(L["pos"]).normalized()
        ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(ob)
        sun_objs.append(ob)
log(f"points={len(point_objs)} suns={len(sun_objs)}")

# 自发光材质：记录 emission 强度，便于按 pass 开关
emissive_slots = []
for o in emitters:
    for mat in o.data.materials:
        if not mat or not mat.use_nodes:
            continue
        for n in mat.node_tree.nodes:
            if n.type == "BSDF_PRINCIPLED":
                s = n.inputs["Emission Strength"]
                if s.default_value > 0:
                    emissive_slots.append((s, s.default_value * EMIT_SCALE))
log(f"emissive slots={len(emissive_slots)}")

world = bpy.data.worlds.new("nightworld")
world.use_nodes = True
scene.world = world
bg = world.node_tree.nodes["Background"]


def set_state(points=False, sun=False, emit=False, sky=False):
    for ob in point_objs:
        ob.hide_render = not points
    for ob in sun_objs:
        ob.hide_render = not sun
    for s, v in emissive_slots:
        s.default_value = v if emit else 0.0
    bg.inputs[0].default_value = (*SKY_COLOR, 1.0) if sky else (0, 0, 0, 1.0)
    bg.inputs[1].default_value = SKY_STRENGTH if sky else 0.0


# ── 烘焙目标图（float），挂到壳的所有材质 ─────────────────────────────────────
img = bpy.data.images.new("bake_target", RES, RES, alpha=False, float_buffer=True)
img.colorspace_settings.name = "Non-Color"
for mat in shell.data.materials:
    mat.use_nodes = True
    nt = mat.node_tree
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = img
    nt.nodes.active = node

scene.render.bake.margin = max(4, RES // 512)
scene.render.bake.use_selected_to_active = False
scene.cycles.max_bounces = 8
scene.cycles.diffuse_bounces = 6


def bake_pass(name, pass_filter, **state):
    set_state(**state)
    bpy.ops.object.select_all(action="DESELECT")
    shell.select_set(True)
    bpy.context.view_layer.objects.active = shell
    # 烘焙用哪层 UV = uv_layers.active
    shell.data.uv_layers.active = shell.data.uv_layers["Lightmap"]
    log(f"bake {name} pass_filter={sorted(pass_filter)} ...")
    bpy.ops.object.bake(type="DIFFUSE", pass_filter=pass_filter)
    buf = np.empty(RES * RES * 4, dtype=np.float32)
    img.pixels.foreach_get(buf)
    rgb = buf.reshape(-1, 4)[:, :3]
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    log(f"bake {name} done, mean={lum.mean():.4f} p99.7={np.percentile(lum, 99.7):.4f}")
    return lum


warm_ind = bake_pass("warm-indirect", {"INDIRECT"}, points=True, emit=True)
warm_dir = bake_pass("emitter-direct", {"DIRECT"}, emit=True)
warm = warm_ind + warm_dir
moon = bake_pass("moon-indirect", {"INDIRECT"}, sun=True)
sky = bake_pass("sky-full", {"DIRECT", "INDIRECT"}, sky=True)


def encode(lum):
    scale = float(max(np.percentile(lum, 99.7), 1e-4))
    stored = np.sqrt(np.clip(lum / scale, 0.0, 1.0))
    return stored, scale


r, r_scale = encode(warm)
g, g_scale = encode(moon)
b, b_scale = encode(sky)
out = bpy.data.images.new("lightmap", RES, RES, alpha=False)
out.colorspace_settings.name = "Non-Color"
px = np.ones(RES * RES * 4, dtype=np.float32)
px[0::4] = r
px[1::4] = g
px[2::4] = b
out.pixels.foreach_set(px)
out.filepath_raw = os.path.join(OUT, "shell-lightmap.png")
out.file_format = "PNG"
out.save()
meta = {"warmScale": r_scale, "moonScale": g_scale, "skyScale": b_scale, "res": RES, "encode": "sqrt"}
with open(os.path.join(OUT, "shell-lightmap.json"), "w", encoding="utf-8") as f:
    json.dump(meta, f, indent=2)
log(f"lightmap saved, scales={meta}")

# ── 导出壳（只导 Shell；材质里的烘焙节点不影响导出的 PBR 参数）────────────────
bpy.ops.object.select_all(action="DESELECT")
shell.select_set(True)
bpy.context.view_layer.objects.active = shell
out_glb = os.path.join(OUT, "shell-baked.glb")
bpy.ops.export_scene.gltf(filepath=out_glb, export_format="GLB", use_selection=True)
log(f"exported {out_glb}")
log("ALL DONE")
