# 试点：给 gramophone.glb 烘一张 AO 贴图（打通 headless Blender 工具链的最小闭环）。
# 用法：blender --background --python tools/bake/bake_gramophone.py -- <in.glb> <out_dir> [res] [samples]
# 产物：<out_dir>/gramophone.glb（重新 smart-UV 的几何 + 原材质名保留）+ <out_dir>/gramophone_ao.png
# 注意：运行时 REMAT 按材质名（mat19 等）重映射——本脚本绝不改材质名。
import bpy
import sys
import os
import math

argv = sys.argv[sys.argv.index("--") + 1 :]
IN_GLB = os.path.abspath(argv[0])
OUT_DIR = os.path.abspath(argv[1])
RES = int(argv[2]) if len(argv) > 2 else 1024
SAMPLES = int(argv[3]) if len(argv) > 3 else 256
os.makedirs(OUT_DIR, exist_ok=True)


def setup_gpu(scene):
    scene.render.engine = "CYCLES"
    scene.cycles.samples = SAMPLES
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for dev_type in ("OPTIX", "CUDA"):
            try:
                prefs.compute_device_type = dev_type
                prefs.get_devices()
                enabled = 0
                for d in prefs.devices:
                    d.use = d.type != "CPU"
                    enabled += 1 if d.use else 0
                if enabled:
                    scene.cycles.device = "GPU"
                    print(f"[bake] GPU via {dev_type}: {[d.name for d in prefs.devices if d.use]}")
                    return
            except Exception as e:  # noqa: BLE001
                print(f"[bake] {dev_type} unavailable: {e}")
    except Exception as e:  # noqa: BLE001
        print(f"[bake] cycles prefs unavailable: {e}")
    scene.cycles.device = "CPU"
    print("[bake] falling back to CPU")


bpy.ops.wm.read_homefile(use_empty=True)
scene = bpy.context.scene
setup_gpu(scene)

bpy.ops.import_scene.gltf(filepath=IN_GLB)
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
assert meshes, "no meshes imported"

# 拍平层级 + 应用变换 + 合并成单体（共享 atlas 的最省事形态）
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.make_single_user(object=True, obdata=True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
obj.name = "gramophone"

# 平滑法线（按角度）：glTF 往返容易把原模型的平滑组拍平成 faceted——
# 喇叭内壁一旦逐面法线，铃口灯的入射点积整片为负=黑月牙（F1 复发的第三种长相）。
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(50.0))

# 只留一张新 smart-project UV（原 UV 没有贴图在用，运行时 aoMap 走 channel 0）
while obj.data.uv_layers:
    obj.data.uv_layers.remove(obj.data.uv_layers[0])
obj.data.uv_layers.new(name="UVMap")
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.004)
bpy.ops.object.mode_set(mode="OBJECT")

# AO 距离按模型自身尺度取（GLB 原生单位未知，运行时反正按包围盒归一化）
dims = obj.dimensions
ao_dist = max(dims.x, dims.y, dims.z) * 0.35
world = bpy.data.worlds.new("bakeworld")
scene.world = world
world.light_settings.distance = ao_dist
print(f"[bake] dims={tuple(round(v, 3) for v in dims)} ao_dist={ao_dist:.3f}")

# 每个材质挂同一张目标图并设为 active 节点
img = bpy.data.images.new("ao_bake", RES, RES, alpha=False)
img.colorspace_settings.name = "Non-Color"
for mat in obj.data.materials:
    mat.use_nodes = True
    nt = mat.node_tree
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = img
    nt.nodes.active = node

scene.render.bake.margin = 8
scene.render.bake.use_selected_to_active = False
bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
print("[bake] baking AO ...")
bpy.ops.object.bake(type="AO")

img.filepath_raw = os.path.join(OUT_DIR, "gramophone_ao.png")
img.file_format = "PNG"
img.save()
print(f"[bake] saved {img.filepath_raw}")

# 导出 GLB（不带贴图——运行时用外置 PNG 当 aoMap；材质名原样保留）
out_glb = os.path.join(OUT_DIR, "gramophone.glb")
bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=out_glb, export_format="GLB", use_selection=True)
print(f"[bake] exported {out_glb}")
mat_names = [m.name for m in obj.data.materials]
print(f"[bake] materials: {mat_names}")
