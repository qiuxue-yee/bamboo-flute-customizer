"""Measure overlap of the original mating parts in an isolated Blender scene."""
import json
from pathlib import Path

import bpy
import bmesh

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "output" / "blender"
PAIRS = (
    ("Part_1_Printable.glb", "Part_2_Printable.glb"),
    ("Part_2_Printable.glb", "Part_3_Printable_Source.glb"),
)


def load_welded(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / "assets" / name))
    objects = [obj for obj in bpy.data.objects if obj not in before and obj.type == "MESH"]
    if len(objects) != 1:
        raise RuntimeError(f"{name}: expected one imported mesh")
    obj = objects[0]
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return obj


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    report = []
    for first, second in PAIRS:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        left = load_welded(first)
        right = load_welded(second)
        bpy.context.view_layer.update()
        modifier = left.modifiers.new("Assembly intersection", "BOOLEAN")
        modifier.operation = "INTERSECT"
        modifier.object = right
        modifier.solver = "EXACT"
        evaluated = left.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = bpy.data.meshes.new_from_object(evaluated)
        bm = bmesh.new()
        bm.from_mesh(mesh)
        volume = bm.calc_volume(signed=False) if bm.faces else 0.0
        non_manifold = sum(not edge.is_manifold for edge in bm.edges)
        faces = len(bm.faces)
        bm.free()
        bpy.data.meshes.remove(mesh)
        report.append({
            "parts": [first, second],
            "intersection_volume_mm3": volume,
            "intersection_faces": faces,
            "intersection_non_manifold_edges": non_manifold,
            "status": "needs-review" if volume > 1e-6 or non_manifold else "geometry-checked",
            "physical_fit_status": "not-verified",
            "note": "Indicative mesh check; physical clearance and fit require a print test.",
        })
        bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT / (first.replace(".glb", "") + "-assembly.blend")))
    (OUTPUT / "assembly-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("ASSEMBLY_CHECK", json.dumps(report))


if __name__ == "__main__":
    main()
