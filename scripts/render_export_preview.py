"""Render the actual browser GLB, including its embedded bamboo and pattern."""
from pathlib import Path
import sys
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "output" / "blender"


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    arguments = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    source = ROOT / arguments[0] if arguments else ROOT / "output" / "playwright" / "verified-part3.glb"
    bpy.ops.import_scene.gltf(filepath=str(source))
    bpy.context.view_layer.update()
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    maximum = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    center = (minimum + maximum) / 2
    world = bpy.data.worlds.new("Studio world")
    world.use_nodes = True
    background = next(node for node in world.node_tree.nodes if node.type == "BACKGROUND")
    background.inputs["Color"].default_value = (0.8, 0.83, 0.77, 1)
    background.inputs["Strength"].default_value = 0.35
    scene = bpy.context.scene
    scene.world = world
    for name, delta, power, size in [
        ("Large softbox", (0.12, -0.03, 0.22), 0.5, 0.2),
        ("Fill softbox", (0.1, 0.16, 0.06), 0.2, 0.15),
    ]:
        light = bpy.data.lights.new(name, "AREA")
        light.energy = power
        light.shape = "DISK"
        light.size = size
        obj = bpy.data.objects.new(name, light)
        scene.collection.objects.link(obj)
        obj.location = center + Vector(delta)
        obj.rotation_euler = (center - obj.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.mesh.primitive_plane_add(size=2, location=(center.x, center.y, minimum.z - 0.006))
    ground = bpy.context.object
    material = bpy.data.materials.new("Light studio ground")
    material.diffuse_color = (0.77, 0.8, 0.74, 1)
    ground.data.materials.append(material)
    camera = bpy.data.objects.new("Export preview camera", bpy.data.cameras.new("Export preview camera"))
    scene.collection.objects.link(camera)
    camera.location = center + Vector((0.24, -0.045, 0.105))
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 0.19
    scene.camera = camera
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 700
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(OUTPUT / "bamboo-export-preview.png")
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT / "bamboo-export-preview.blend"))
    bpy.ops.render.render(write_still=True)
    print("BAMBOO_EXPORT_PREVIEW", scene.render.filepath)


if __name__ == "__main__":
    main()
