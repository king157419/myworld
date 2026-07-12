# 重雕留声机（第十三轮）：程序化建一只"雕塑感"留声机替换 poly.pizza 低模。
# 喇叭 = 参数化牵牛花壳（指数扩口 + 8 瓣花瓣调制 + 缘口波浪），鹅颈管贝塞尔扫掠，
# 倒角木箱 + 唱盘毛毡 + 唱臂 + 摇柄。材质名语义化（brass/brass_inner/brass_dark/steel/wood/wood_dark/felt），
# 运行时 GramophoneModel.REMAT 按这些名字重映射到调色板。
#
# 坐标约定：Blender Z 上 / 正面朝 -Y（glTF 导出后喇叭口朝 +Z，运行时 ROT_Y=0）。
# 关键联动尺寸：唱盘顶面 z≈0.252（RecordPlayer 旋转碟在局部 y=0.26）；总高≈1.33。
# 资产自带正确 pivot（唱盘中心在原点）——运行时只做高度归一 + 贴地，不再 xz 重心居中。
#
# 用法：
#   blender --background --python tools/bake/build_gramophone.py -- <out_dir> [render] [bake <res> <samples>]
# 产物：render → gram_view*.png 预览；bake → gramophone.glb + gramophone_ao.png
import bpy
import math
import os
import sys

argv = sys.argv[sys.argv.index("--") + 1 :]
OUT_DIR = os.path.abspath(argv[0])
DO_RENDER = "render" in argv
DO_BAKE = "bake" in argv
BAKE_RES = int(argv[argv.index("bake") + 1]) if DO_BAKE and len(argv) > argv.index("bake") + 1 else 1024
BAKE_SAMPLES = int(argv[argv.index("bake") + 2]) if DO_BAKE and len(argv) > argv.index("bake") + 2 else 256
os.makedirs(OUT_DIR, exist_ok=True)

bpy.ops.wm.read_homefile(use_empty=True)
scene = bpy.context.scene


def setup_gpu():
    scene.render.engine = "CYCLES"
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
                    print(f"[build] GPU via {dev_type}")
                    return
            except Exception as e:  # noqa: BLE001
                print(f"[build] {dev_type} unavailable: {e}")
    except Exception as e:  # noqa: BLE001
        print(f"[build] cycles prefs unavailable: {e}")
    scene.cycles.device = "CPU"


setup_gpu()

# ── 材质（预览用 Principled；运行时按名重映射，颜色无所谓但便于看渲染）──
def mk_mat(name, color, metallic, rough, emit=None, emit_str=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit_str
    return m


MAT = {
    "brass": mk_mat("brass", (0.68, 0.51, 0.26), 1.0, 0.28),
    "brass_inner": mk_mat("brass_inner", (0.80, 0.60, 0.32), 1.0, 0.38, emit=(1.0, 0.55, 0.22), emit_str=0.35),
    "brass_dark": mk_mat("brass_dark", (0.38, 0.28, 0.14), 1.0, 0.42),
    "steel": mk_mat("steel", (0.55, 0.56, 0.58), 1.0, 0.35),
    "wood": mk_mat("wood", (0.16, 0.095, 0.05), 0.0, 0.55),
    "wood_dark": mk_mat("wood_dark", (0.07, 0.045, 0.028), 0.0, 0.6),
    "felt": mk_mat("felt", (0.08, 0.1, 0.08), 0.0, 0.9),
    "vinyl": mk_mat("vinyl", (0.02, 0.02, 0.025), 0.4, 0.2),
}

PARTS = []


def finalize(obj, mats, smooth_angle=50.0):
    """挂材质、按角度平滑、收进部件表。mats: [主材质] 或 [外, 内]。"""
    for name in mats:
        obj.data.materials.append(MAT[name])
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_angle))
    PARTS.append(obj)
    return obj


def add_box(name, size, loc, mats, bevel=0.008, seg=3, smooth_angle=35.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size  # size=1 的方块边长即 1，scale 直接就是目标尺寸
    bpy.ops.object.transform_apply(scale=True)
    if bevel > 0:
        mod = o.modifiers.new("bev", "BEVEL")
        mod.width = bevel
        mod.segments = seg
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finalize(o, mats, smooth_angle)


def add_cyl(name, r, h, loc, mats, verts=48, smooth_angle=35.0, rot=None):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=verts, location=loc)
    o = bpy.context.active_object
    o.name = name
    if rot:
        o.rotation_euler = rot
    bpy.ops.object.transform_apply(rotation=True)
    return finalize(o, mats, smooth_angle)


def add_swept_curve(name, points, radius, mats, resolution=24, smooth_angle=60.0, taper=None):
    """贝塞尔扫掠管。points: [(co, handle_l, handle_r), ...]；taper: (首径比, 尾径比)。"""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 8
    cu.resolution_u = resolution
    cu.fill_mode = "FULL"
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(points) - 1)
    for bp, (co, hl, hr) in zip(sp.bezier_points, points):
        bp.co = co
        bp.handle_left = hl
        bp.handle_right = hr
        bp.handle_left_type = bp.handle_right_type = "FREE"
    if taper:
        for i, bp in enumerate(sp.bezier_points):
            bp.radius = taper[0] + (taper[1] - taper[0]) * (i / (len(points) - 1))
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.active_object
    o.name = name
    return finalize(o, mats, smooth_angle)


# ══ 1. 木箱（底裙 + 箱体 + 顶盖，前面板微内嵌线条）══
add_box("plinth", (0.50, 0.50, 0.032), (0, 0, 0.016), ["wood_dark"], bevel=0.006)
add_box("cabinet", (0.46, 0.46, 0.196), (0, 0, 0.032 + 0.098), ["wood"], bevel=0.010)
add_box("lid", (0.485, 0.485, 0.024), (0, 0, 0.228 + 0.012), ["wood_dark"], bevel=0.007)
# 前面板嵌饰条（雕塑感的细节层次）
add_box("front_trim", (0.36, 0.012, 0.13), (0, -0.232, 0.13), ["wood_dark"], bevel=0.004)
# 四只黄铜垫脚
for sx in (-1, 1):
    for sy in (-1, 1):
        add_cyl(f"foot_{sx}_{sy}", 0.022, 0.012, (0.21 * sx, 0.21 * sy, 0.006), ["brass_dark"], verts=24)

# ══ 2. 唱盘毛毡（顶面 z=0.252 与盖面齐平）══
add_cyl("felt_pad", 0.175, 0.006, (0, 0.02, 0.249), ["felt"], verts=64)
add_cyl("spindle", 0.004, 0.02, (0, 0.02, 0.26), ["steel"], verts=16)

# ══ 3. 唱臂（右侧基座 + 弯管 + 头壳）══
add_cyl("arm_base", 0.028, 0.05, (0.185, 0.185, 0.252 + 0.025), ["steel"], verts=32)
add_swept_curve(
    "tonearm",
    [
        ((0.185, 0.185, 0.30), (0.185, 0.185, 0.27), (0.185, 0.185, 0.33)),
        ((0.10, 0.10, 0.295), (0.15, 0.15, 0.305), (0.06, 0.06, 0.288)),
        ((0.045, -0.045, 0.272), (0.06, 0.01, 0.278), (0.04, -0.07, 0.269)),
    ],
    0.007,
    ["steel"],
    taper=(1.0, 0.85),
)
add_cyl("arm_head", 0.012, 0.028, (0.045, -0.055, 0.264), ["brass_dark"], verts=24)

# ══ 4. 摇柄（右侧板伸出）══
add_swept_curve(
    "crank",
    [
        ((0.23, 0.05, 0.13), (0.20, 0.05, 0.13), (0.27, 0.05, 0.13)),
        ((0.30, 0.05, 0.13), (0.28, 0.05, 0.13), (0.32, 0.05, 0.13)),
        ((0.315, 0.05, 0.085), (0.315, 0.05, 0.11), (0.315, 0.05, 0.06)),
    ],
    0.009,
    ["brass_dark"],
)
add_cyl("crank_knob", 0.016, 0.045, (0.315, 0.05, 0.048), ["wood_dark"], verts=24)

# ══ 5. 鹅颈管（盖后中央 → 喇叭喉）══
THROAT = (0, 0.155, 0.44)  # 喇叭喉部起点
add_swept_curve(
    "gooseneck",
    [
        ((0, 0.17, 0.245), (0, 0.17, 0.20), (0, 0.17, 0.31)),
        ((0, 0.185, 0.36), (0, 0.19, 0.315), (0, 0.18, 0.40)),
        (THROAT, (0, 0.17, 0.415), (0, 0.14, 0.465)),
    ],
    0.020,
    ["brass_dark"],
    taper=(1.0, 1.15),
)
# 鹅颈根部法兰
add_cyl("neck_flange", 0.036, 0.014, (0, 0.17, 0.252), ["brass_dark"], verts=32)

# ══ 6. 喇叭：参数化牵牛花壳 ══
# 轴：从喉部向前上方（-Y 前 / +Z 上），自垂直前倾 α。
ALPHA = math.radians(30.0)
AXIS = (0.0, -math.sin(ALPHA), math.cos(ALPHA))
L = 0.86           # 沿轴长度
R_THROAT = 0.024   # 喉半径（衔接鹅颈 0.020*1.15≈0.023）
R_MOUTH = 0.31     # 铃口半径
N_PETAL = 8        # 花瓣数
K_FLARE = 3.4      # 指数扩口锐度（越大越"牵牛花"）
RINGS, SEGS = 72, 96

# 轴的正交基（垂直平面内 u=x 轴向, v=面内朝上分量）
U = (1.0, 0.0, 0.0)
V = (0.0, math.cos(ALPHA), math.sin(ALPHA))

verts, faces = [], []
ek = math.exp(K_FLARE) - 1.0
for i in range(RINGS + 1):
    t = i / RINGS
    flare = (math.exp(K_FLARE * t) - 1.0) / ek
    r_base = R_THROAT + (R_MOUTH - R_THROAT) * flare
    petal_amp = 0.050 * (t ** 3.0)          # 花瓣起伏：喉部圆、口部深裂
    rim_ext = 0.030 * max(0.0, (t - 0.9) / 0.1) ** 2  # 缘口花瓣尖沿轴外探
    for j in range(SEGS):
        th = 2 * math.pi * j / SEGS
        pet = math.cos(N_PETAL * th)
        r = r_base * (1.0 + petal_amp * pet)
        ax = L * t + rim_ext * (0.5 + 0.5 * pet)
        px = THROAT[0] + AXIS[0] * ax + (U[0] * math.cos(th) + V[0] * math.sin(th)) * r
        py = THROAT[1] + AXIS[1] * ax + (U[1] * math.cos(th) + V[1] * math.sin(th)) * r
        pz = THROAT[2] + AXIS[2] * ax + (U[2] * math.cos(th) + V[2] * math.sin(th)) * r
        verts.append((px, py, pz))
for i in range(RINGS):
    for j in range(SEGS):
        a = i * SEGS + j
        b = i * SEGS + (j + 1) % SEGS
        c = (i + 1) * SEGS + (j + 1) % SEGS
        d = (i + 1) * SEGS + j
        faces.append((a, b, c, d))

mesh = bpy.data.meshes.new("horn")
mesh.from_pydata(verts, [], faces)
mesh.update()
horn = bpy.data.objects.new("horn", mesh)
bpy.context.collection.objects.link(horn)
for p in horn.data.polygons:
    p.use_smooth = True
horn.data.materials.append(MAT["brass"])        # slot 0 外壁（参数面本体）
horn.data.materials.append(MAT["brass_inner"])  # slot 1 内壁（solidify 新生成面）
bpy.ops.object.select_all(action="DESELECT")
horn.select_set(True)
bpy.context.view_layer.objects.active = horn
# from_pydata 的环带 quad 绕向不保证一致——法线先统一朝外。
# Cycles 双面渲染看不出坏法线，three.js 单面剔除会把喇叭渲成"黑洞剪影"。
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode="OBJECT")
mod = horn.modifiers.new("solid", "SOLIDIFY")
mod.thickness = 0.0035
mod.offset = -1.0           # 法线朝外 + 向内加厚：参数面保持为外表面
mod.use_rim = True
mod.material_offset = 1
mod.material_offset_rim = 1
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(60.0))
PARTS.append(horn)

# 喉部箍环
add_cyl(
    "throat_ring", 0.030, 0.03,
    (THROAT[0] + AXIS[0] * 0.012, THROAT[1] + AXIS[1] * 0.012, THROAT[2] + AXIS[2] * 0.012),
    ["brass_dark"], verts=32, rot=(ALPHA, 0, 0),
)

# 喇叭支撑杆（盖面 → 喇叭中段，撑住前倾的壳）
MID = (THROAT[0] + AXIS[0] * 0.42, THROAT[1] + AXIS[1] * 0.42, THROAT[2] + AXIS[2] * 0.42)
add_swept_curve(
    "horn_brace",
    [
        ((0.0, -0.14, 0.252), (0.0, -0.14, 0.22), (0.0, -0.14, 0.30)),
        ((MID[0], MID[1] + 0.02, MID[2] - 0.055), (0.0, MID[1] + 0.02, MID[2] - 0.14), (MID[0], MID[1] + 0.02, MID[2] - 0.02)),
    ],
    0.006,
    ["steel"],
)

# ── 汇总信息 ──
mins = [min((o.matrix_world @ v.co)[i] for o in PARTS for v in o.data.vertices) for i in range(3)]
maxs = [max((o.matrix_world @ v.co)[i] for o in PARTS for v in o.data.vertices) for i in range(3)]
print(f"[build] parts={len(PARTS)} bbox z: {mins[2]:.3f}..{maxs[2]:.3f} y: {mins[1]:.3f}..{maxs[1]:.3f}")

# ══ 预览渲染 ══
if DO_RENDER:
    world = bpy.data.worlds.new("w")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.012, 0.014, 0.02, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 1.0

    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor.data.materials.append(mk_mat("floor", (0.05, 0.05, 0.06), 0.1, 0.4))

    def lamp(name, loc, power, color, size=0.3):
        li = bpy.data.lights.new(name, "POINT")
        li.energy = power
        li.color = color
        li.shadow_soft_size = size
        o = bpy.data.objects.new(name, li)
        o.location = loc
        bpy.context.collection.objects.link(o)

    lamp("key", (1.1, -1.4, 1.5), 220, (1.0, 0.72, 0.45))       # 暖主光（模拟灯笼）
    lamp("rim", (-1.4, 1.2, 1.9), 90, (0.55, 0.65, 1.0))        # 冷月轮廓
    lamp("bell", (0, -0.16, 1.02), 18, (1.0, 0.62, 0.3), 0.08)  # 铃口内暖芯

    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 900
    scene.render.image_settings.file_format = "PNG"

    cams = {
        "gram_view_front34": ((1.05, -1.35, 1.05), (0, 0.02, 0.55)),
        "gram_view_horn": ((0.55, -0.95, 1.25), (0, -0.12, 0.95)),
        "gram_view_back34": ((-1.0, 1.3, 1.0), (0, 0.0, 0.55)),
    }
    import mathutils
    for name, (loc, look) in cams.items():
        cam = bpy.data.cameras.new(name)
        co = bpy.data.objects.new(name, cam)
        co.location = loc
        d = mathutils.Vector(look) - mathutils.Vector(loc)
        co.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        bpy.context.collection.objects.link(co)
        scene.camera = co
        scene.render.filepath = os.path.join(OUT_DIR, f"{name}.png")
        bpy.ops.render.render(write_still=True)
        print(f"[build] rendered {scene.render.filepath}")

# ══ AO 烘焙 + GLB 导出（与 bake_gramophone.py 同法）══
if DO_BAKE:
    # 去掉渲染道具，只留部件
    bpy.ops.object.select_all(action="DESELECT")
    for o in list(bpy.data.objects):
        if o not in PARTS:
            bpy.data.objects.remove(o, do_unlink=True)
    for o in PARTS:
        o.select_set(True)
    bpy.context.view_layer.objects.active = PARTS[0]
    bpy.ops.object.make_single_user(object=True, obdata=True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = "gramophone"

    while obj.data.uv_layers:
        obj.data.uv_layers.remove(obj.data.uv_layers[0])
    obj.data.uv_layers.new(name="UVMap")
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.003)
    bpy.ops.object.mode_set(mode="OBJECT")

    dims = obj.dimensions
    world = bpy.data.worlds.new("bakeworld")
    scene.world = world
    world.light_settings.distance = max(dims) * 0.35

    img = bpy.data.images.new("ao_bake", BAKE_RES, BAKE_RES, alpha=False)
    img.colorspace_settings.name = "Non-Color"
    for mat in obj.data.materials:
        nt = mat.node_tree
        node = nt.nodes.new("ShaderNodeTexImage")
        node.image = img
        nt.nodes.active = node

    scene.cycles.samples = BAKE_SAMPLES
    scene.render.bake.margin = 8
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    print("[build] baking AO ...")
    bpy.ops.object.bake(type="AO")
    img.filepath_raw = os.path.join(OUT_DIR, "gramophone_ao.png")
    img.file_format = "PNG"
    img.save()
    print(f"[build] saved {img.filepath_raw}")

    out_glb = os.path.join(OUT_DIR, "gramophone.glb")
    bpy.ops.export_scene.gltf(filepath=out_glb, export_format="GLB", use_selection=True)
    tri = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    print(f"[build] exported {out_glb} tris={tri} materials={[m.name for m in obj.data.materials]}")
