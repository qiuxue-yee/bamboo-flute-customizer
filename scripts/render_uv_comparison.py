"""Render the two calibrated image surfaces with the same directional test PNG."""
import math
from pathlib import Path

import bpy
import bmesh
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "output" / "blender"
PATTERN = ROOT / "output" / "playwright" / "directional.png"


def pattern_material():
    material = bpy.data.materials.new("Directional UV test")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    image = nodes.new("ShaderNodeTexImage")
    image.image = bpy.data.images.load(str(PATTERN), check_existing=True)
    image.image.pack()
    mix = nodes.new("ShaderNodeMixRGB")
    mix.blend_type = "MIX"
    mix.inputs[1].default_value = (0.8, 0.8, 0.8, 1)
    material.node_tree.links.new(image.outputs["Alpha"], mix.inputs[0])
    material.node_tree.links.new(image.outputs["Color"], mix.inputs[2])
    emission = nodes.new("ShaderNodeEmission")
    material.node_tree.links.new(mix.outputs[0], emission.inputs["Color"])
    output = nodes.new("ShaderNodeOutputMaterial")
    material.node_tree.links.new(emission.outputs[0], output.inputs["Surface"])
    return material


def add_patch(filename, z_offset, material):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / "assets" / "generated" / filename))
    imported = [obj for obj in bpy.data.objects if obj not in before and obj.type == "MESH"]
    if len(imported) != 1:
        raise RuntimeError(f"{filename}: expected one mesh")
    original = imported[0]
    bpy.context.view_layer.update()
    image_index = next(i for i, slot in enumerate(original.material_slots)
                       if slot.material and slot.material.name.startswith("Custom_Area_Image"))
    bm = bmesh.new()
    bm.from_mesh(original.data)
    bmesh.ops.delete(bm, geom=[face for face in bm.faces if face.material_index != image_index], context="FACES")
    bmesh.ops.delete(bm, geom=[vertex for vertex in bm.verts if not vertex.link_faces], context="VERTS")
    for face in bm.faces:
        face.material_index = 0
    mesh = bpy.data.meshes.new(filename + " image surface")
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(material)
    patch = bpy.data.objects.new(filename + " image surface", mesh)
    bpy.context.scene.collection.objects.link(patch)
    transform = original.matrix_world.copy()
    transform.translation.z += z_offset
    patch.matrix_world = transform
    original.hide_render = True
    return patch


def add_label(text, z):
    curve = bpy.data.curves.new(text, "FONT")
    curve.body = text
    curve.size = 4.2
    material = bpy.data.materials.new(text + " label")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (0.85, 0.85, 0.85, 1)
    output = nodes.new("ShaderNodeOutputMaterial")
    material.node_tree.links.new(emission.outputs[0], output.inputs["Surface"])
    curve.materials.append(material)
    obj = bpy.data.objects.new(text, curve)
    bpy.context.scene.collection.objects.link(obj)
    # Text local x/y axes point along the image's horizontal/vertical axes.
    rotation = Matrix(((0, 0, 1), (1, 0, 0), (0, 1, 0))).to_4x4()
    rotation.translation = Vector((17, -615, z))
    obj.matrix_world = rotation


def main():
    if not PATTERN.exists():
        raise RuntimeError("Generate output/playwright/directional.png first")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    material = pattern_material()
    add_patch("Dizi_Display.glb", 26, material)
    add_patch("Part_3_Printable_Source.glb", -26, material)
    add_label("DISPLAY MODEL", 44)
    add_label("PRINTABLE PART 3", -8)
    camera_data = bpy.data.cameras.new("Comparison camera")
    camera = bpy.data.objects.new("Comparison camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = (200, -576.8, 0)
    camera.rotation_euler = (Vector((0, -576.8, 0)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 132
    scene = bpy.context.scene
    scene.camera = camera
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 8
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new("Comparison background")
    scene.world.color = (0.12, 0.12, 0.12)
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(OUTPUT / "uv-comparison.png")
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT / "uv-comparison.blend"))
    bpy.ops.render.render(write_still=True)
    print("UV_COMPARISON", scene.render.filepath)


if __name__ == "__main__":
    main()
