# 望远镜（观星台·"看记忆"舞台件，第十四轮）：程序化建一只雕塑感黄铜折射望远镜，
# 取代 Deck.tsx 里三根圆柱堆的粗糙"朝天镜"。
#   镜筒（OTA）= 主镜筒 + 前端遮光罩 + 物镜玻璃 + 雕刻箍环；仰角 57° 朝天。
#   星对角镜把目镜折向来客侧（-Y → glTF +Z），"凑近目镜看进去"这一动作成立。
#   经纬托架 = 锥形木三脚架（黄铜脚箍 + 撑盘）→ 黄铜方位座 → 曲臂双抱箍夹镜筒。
#   调焦座 + 双调焦轮 + 平行寻星镜（雕塑细节层次）。
# 材质名语义化（brass/brass_inner/brass_dark/steel/wood/wood_dark/glass），
# 运行时 TelescopeModel.REMAT 按这些名字重映射到调色板。
#
# 坐标约定：Blender Z 上；镜筒物镜朝上偏 +Y，目镜（星对角）朝 -Y。
#   glTF 导出（x,y,z)->(x,z,-y)：物镜朝 +Y→-Z（望向后方夜空），目镜朝 -Y→+Z（迎向来客）。
#   资产自带 pivot（方位轴在 x=z 原点、三脚落面 z=0）——运行时只做高度归一 + 贴地。
#
# 关键联动尺寸（TelescopeModel 需知，用于相机"看向目镜"）：
#   仰角 ELE=57°；目镜口 局部坐标 ≈ (0,-0.26,0.70)（Blender）→ glTF (0,0.70,0.26)。
#   物镜方向 AXIS_gltf ≈ (0, 0.839, -0.545)（朝天偏后）。native 高度 ≈ 1.50。
#
# 用法：
#   blender --background --python tools/bake/build_telescope.py -- <out_dir> [render] [bake <res> <samples>]
# 产物：render → tele_view*.png 预览；bake → telescope.glb + telescope_ao.png
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


# ── 材质（预览用 Principled；运行时按名重映射）──
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
    "brass": mk_mat("brass", (0.68, 0.51, 0.26), 1.0, 0.30),
    "brass_inner": mk_mat("brass_inner", (0.80, 0.60, 0.32), 1.0, 0.40, emit=(1.0, 0.55, 0.22), emit_str=0.30),
    "brass_dark": mk_mat("brass_dark", (0.36, 0.27, 0.13), 1.0, 0.44),
    "steel": mk_mat("steel", (0.55, 0.56, 0.58), 1.0, 0.35),
    "wood": mk_mat("wood", (0.16, 0.095, 0.05), 0.0, 0.55),
    "wood_dark": mk_mat("wood_dark", (0.07, 0.045, 0.028), 0.0, 0.6),
    "glass": mk_mat("glass", (0.02, 0.03, 0.06), 0.15, 0.06, emit=(0.5, 0.65, 1.0), emit_str=0.25),
}

PARTS = []


def finalize(obj, mats, smooth_angle=50.0):
    for name in mats:
        obj.data.materials.append(MAT[name])
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_angle))
    PARTS.append(obj)
    return obj


def add_box(name, size, loc, mats, bevel=0.006, seg=3, smooth_angle=35.0, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    if rot:
        o.rotation_euler = rot
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    if bevel > 0:
        mod = o.modifiers.new("bev", "BEVEL")
        mod.width = bevel
        mod.segments = seg
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finalize(o, mats, smooth_angle)


def add_cyl(name, r, h, loc, mats, verts=48, smooth_angle=35.0, rot=None, cone_r2=None):
    if cone_r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=verts, location=loc)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=cone_r2, depth=h, vertices=verts, location=loc)
    o = bpy.context.active_object
    o.name = name
    if rot:
        o.rotation_euler = rot
    bpy.ops.object.transform_apply(rotation=True)
    return finalize(o, mats, smooth_angle)


def add_swept_curve(name, points, radius, mats, resolution=24, smooth_angle=60.0, taper=None, bevres=8):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = bevres
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


# ═══ 几何骨架 ═══════════════════════════════════════════════════════════════
# 镜筒轴（OTA）：仰角 ELE，从水平抬起，物镜朝上偏 +Y。
ELE = math.radians(57.0)
AXIS = (0.0, math.cos(ELE), math.sin(ELE))          # 物镜方向（前）
NRM = (0.0, -math.sin(ELE), math.cos(ELE))          # 与轴垂直、指"上前"（放调焦座/寻星镜用）
ROT_TUBE = (ELE - math.pi / 2, 0.0, 0.0)            # 把默认 +Z 圆柱对齐到 AXIS


def on_axis(base, s, off_n=0.0, off_x=0.0):
    """镜筒轴上参数点：base + AXIS*s + NRM*off_n + X*off_x。"""
    return (
        base[0] + AXIS[0] * s + NRM[0] * off_n + off_x,
        base[1] + AXIS[1] * s + NRM[1] * off_n,
        base[2] + AXIS[2] * s + NRM[2] * off_n,
    )


B = (0.0, -0.06, 0.72)     # 镜筒后端中心（星对角镜接口处）
L_TUBE = 0.86              # 镜筒长
R_TUBE = 0.072             # 镜筒半径

# ══ 1. 三脚架：三条锥形木腿（上粗下细）+ 黄铜脚箍 + 顶部铰接毂 ══
Z_APEX = 0.60
RF = 0.44                  # 脚落地半径
AZ = [math.pi / 2, math.pi * 7 / 6, math.pi * 11 / 6]  # 一腿朝 +Y(后)、两腿朝前
for i, a in enumerate(AZ):
    fx, fy = RF * math.cos(a), RF * math.sin(a)
    ax, ay = 0.05 * math.cos(a), 0.05 * math.sin(a)     # 顶端微散开
    add_swept_curve(
        f"leg_{i}",
        [
            ((ax, ay, Z_APEX), (ax * 0.6, ay * 0.6, Z_APEX + 0.02), ((ax + fx) / 2, (ay + fy) / 2, Z_APEX * 0.55)),
            ((fx, fy, 0.0), ((ax + fx) / 2, (ay + fy) / 2, Z_APEX * 0.42), (fx, fy, -0.05)),
        ],
        0.028,
        ["wood"],
        taper=(1.0, 0.6),
    )
    # 黄铜脚箍
    add_cyl(f"foot_{i}", 0.026, 0.05, (fx, fy, 0.025), ["brass_dark"], verts=20)

# 撑盘：中央黄铜小毂 + 三根撑杆连到腿中段（雕塑层次 + 稳定读感）
add_cyl("spreader_hub", 0.05, 0.028, (0, 0, 0.27), ["brass_dark"], verts=24)
for i, a in enumerate(AZ):
    mx, my = 0.22 * math.cos(a), 0.22 * math.sin(a)
    add_swept_curve(
        f"spreader_{i}",
        [((0, 0, 0.27), (0.04 * math.cos(a), 0.04 * math.sin(a), 0.27), (mx * 0.5, my * 0.5, 0.272)),
         ((mx, my, 0.255), (mx * 0.7, my * 0.7, 0.262), (mx, my, 0.25))],
        0.009,
        ["brass_dark"],
    )
# 顶部铰接毂
add_cyl("apex_hub", 0.058, 0.11, (0, 0, Z_APEX + 0.01), ["brass_dark"], verts=32)

# ══ 2. 方位座（可转）+ 曲臂托架 ══
add_cyl("az_base", 0.072, 0.045, (0, 0, 0.665), ["brass_dark"], verts=40)
add_cyl("az_post", 0.044, 0.16, (0, 0, 0.765), ["brass"], verts=32)
add_cyl("az_collar", 0.052, 0.03, (0, 0, 0.845), ["brass_dark"], verts=32)

# 抱箍中心（镜筒平衡点两侧）
C1 = on_axis(B, 0.28)
C2 = on_axis(B, 0.58)
# 曲臂：从方位座顶弧线升到抱箍下方（swept curve，雕塑感）
yoke_top = on_axis(B, 0.30, off_n=-R_TUBE - 0.02)
add_swept_curve(
    "yoke",
    [
        ((0, 0.0, 0.85), (0, -0.02, 0.83), (0, 0.03, 0.90)),
        ((0, 0.06, 0.94), (0, 0.03, 0.90), (0, 0.09, 0.98)),
        (yoke_top, (yoke_top[0], yoke_top[1] - 0.04, yoke_top[2] - 0.04), yoke_top),
    ],
    0.020,
    ["brass"],
    taper=(1.2, 0.85),
)
# 抱箍下的鞍梁（连住两抱箍）
sad1 = on_axis(B, 0.28, off_n=-R_TUBE - 0.006)
sad2 = on_axis(B, 0.58, off_n=-R_TUBE - 0.006)
add_swept_curve("saddle_bar", [(sad1, sad1, sad1), (sad2, sad2, sad2)], 0.016, ["brass_dark"])

# 两只抱箍（略大半径的短筒 + 侧面小指旋钮）
for k, C in ((1, C1), (2, C2)):
    add_cyl(f"ring_{k}", R_TUBE + 0.016, 0.026, C, ["brass"], verts=44, rot=ROT_TUBE)
    kn = on_axis(B, 0.28 if k == 1 else 0.58, off_n=-R_TUBE - 0.012)
    add_cyl(f"ring_knob_{k}", 0.012, 0.03, kn, ["brass_dark"], verts=16, rot=ROT_TUBE)

# ══ 3. 镜筒本体（主筒 + 雕刻箍环 + 前遮光罩 + 物镜玻璃 + 后端环）══
tube_center = on_axis(B, L_TUBE / 2)
add_cyl("tube", R_TUBE, L_TUBE, tube_center, ["brass"], verts=64, rot=ROT_TUBE, smooth_angle=60.0)
# 雕刻箍环（brass_dark 细带，装饰层次）
for s in (0.16, 0.42, 0.68):
    add_cyl(f"band_{int(s*100)}", R_TUBE + 0.004, 0.022, on_axis(B, s), ["brass_dark"], verts=48, rot=ROT_TUBE)
# 前端遮光罩（略外扩的锥筒）+ 物镜玻璃 + 罩口环
dew_c = on_axis(B, L_TUBE + 0.05)
add_cyl("dewshield", R_TUBE + 0.014, 0.12, dew_c, ["brass"], verts=64, rot=ROT_TUBE, cone_r2=R_TUBE + 0.004)
add_cyl("dew_lip", R_TUBE + 0.02, 0.016, on_axis(B, L_TUBE + 0.108), ["brass_dark"], verts=48, rot=ROT_TUBE)
add_cyl("objective", R_TUBE - 0.004, 0.012, on_axis(B, L_TUBE - 0.02), ["glass"], verts=64, rot=ROT_TUBE)
# 后端底盖
add_cyl("backplate", R_TUBE + 0.006, 0.02, on_axis(B, -0.01), ["brass_dark"], verts=48, rot=ROT_TUBE)

# ══ 4. 调焦座 + 星对角镜 + 目镜（后端，朝 -Y 迎来客）══
# 调焦座：镜筒后段侧面（+X）一个方块 + 抽出的钢制调焦筒 + 两侧黄铜调焦轮
foc_c = on_axis(B, 0.20, off_n=R_TUBE + 0.03, off_x=0.0)
add_box("focuser", (0.09, 0.07, 0.06), foc_c, ["brass_dark"], bevel=0.006, rot=ROT_TUBE)
for sx in (-1, 1):
    add_cyl(f"focus_knob_{sx}", 0.026, 0.02, (foc_c[0] + sx * 0.055, foc_c[1], foc_c[2]),
            ["brass"], verts=24, rot=(0, math.pi / 2, 0))

# 星对角镜：后端一个黄铜肘 + 朝 -Y 的目镜筒 + 目镜玻璃
diag_c = on_axis(B, -0.03)
add_cyl("diagonal", R_TUBE - 0.006, 0.07, (diag_c[0], diag_c[1] - 0.02, diag_c[2] - 0.02),
        ["brass_dark"], verts=36, rot=(math.pi / 2 + 0.2, 0, 0))
EYE_TUBE = (0.0, -0.17, 0.705)   # 目镜筒中心
add_cyl("eyepiece", 0.03, 0.09, EYE_TUBE, ["brass"], verts=32, rot=(math.pi / 2, 0, 0), cone_r2=0.026)
add_cyl("eyecup", 0.032, 0.02, (0.0, -0.216, 0.705), ["brass_dark"], verts=32, rot=(math.pi / 2, 0, 0))
add_cyl("eye_lens", 0.024, 0.008, (0.0, -0.224, 0.705), ["glass"], verts=32, rot=(math.pi / 2, 0, 0))

# ══ 5. 寻星镜（平行主筒的小镜，+X 上方偏置）══
fs_base = on_axis(B, 0.30, off_n=R_TUBE + 0.03, off_x=0.09)
fs_front = on_axis(B, 0.30 + 0.24, off_n=R_TUBE + 0.03, off_x=0.09)
fs_back = on_axis(B, 0.30 - 0.02, off_n=R_TUBE + 0.03, off_x=0.09)
add_cyl("finder", 0.018, 0.26, fs_base, ["brass"], verts=28, rot=ROT_TUBE)
add_cyl("finder_obj", 0.02, 0.014, fs_front, ["glass"], verts=28, rot=ROT_TUBE)
add_cyl("finder_eye", 0.014, 0.016, fs_back, ["brass_dark"], verts=24, rot=ROT_TUBE)
# 寻星镜支架（两只小环脚接到主筒）
for s in (0.24, 0.36):
    p_tube = on_axis(B, s, off_n=R_TUBE)
    p_fs = on_axis(B, s, off_n=R_TUBE + 0.03, off_x=0.09)
    add_swept_curve(f"finder_foot_{int(s*100)}", [(p_tube, p_tube, p_tube), (p_fs, p_fs, p_fs)], 0.006, ["steel"])

# ── 汇总信息 ──
mins = [min((o.matrix_world @ v.co)[i] for o in PARTS for v in o.data.vertices) for i in range(3)]
maxs = [max((o.matrix_world @ v.co)[i] for o in PARTS for v in o.data.vertices) for i in range(3)]
print(f"[build] parts={len(PARTS)} bbox x:{mins[0]:.2f}..{maxs[0]:.2f} y:{mins[1]:.2f}..{maxs[1]:.2f} z:{mins[2]:.2f}..{maxs[2]:.2f}")

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

    lamp("key", (1.3, -1.5, 1.7), 260, (1.0, 0.72, 0.45))
    lamp("rim", (-1.5, 1.3, 2.1), 110, (0.55, 0.65, 1.0))
    lamp("eye", (0, -0.5, 0.75), 8, (1.0, 0.6, 0.3), 0.06)

    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 900
    scene.render.image_settings.file_format = "PNG"

    cams = {
        "tele_view_front34": ((1.5, -1.7, 1.35), (0, 0.05, 0.95)),
        "tele_view_side": ((2.0, 0.1, 1.1), (0, 0.1, 1.0)),
        "tele_view_eye": ((0.35, -1.1, 0.85), (0, -0.15, 0.72)),
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

# ══ AO 烘焙 + GLB 导出 ══
if DO_BAKE:
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
    obj.name = "telescope"

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
    img.filepath_raw = os.path.join(OUT_DIR, "telescope_ao.png")
    img.file_format = "PNG"
    img.save()
    print(f"[build] saved {img.filepath_raw}")

    out_glb = os.path.join(OUT_DIR, "telescope.glb")
    bpy.ops.export_scene.gltf(filepath=out_glb, export_format="GLB", use_selection=True)
    tri = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    print(f"[build] exported {out_glb} tris={tri} materials={[m.name for m in obj.data.materials]}")
