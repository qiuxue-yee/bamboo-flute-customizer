"""Verify UV calibration and geometry after reimporting the generated GLBs."""
import json
import math
from collections import Counter
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "output" / "blender"
NAMES = ("Dizi_Display.glb", "Part_3_Printable_Source.glb")
AXIAL_MIN, AXIAL_MAX = -612.4, -541.2


def load(path, verify_uv):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    points, triangles, uv_errors = [], [], []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        mesh = obj.data
        uv = mesh.uv_layers.active
        for polygon in mesh.polygons:
            material = obj.material_slots[polygon.material_index].material.name
            vertices = []
            for index in polygon.loop_indices:
                vertex = mesh.vertices[mesh.loops[index].vertex_index]
                point = obj.matrix_world @ vertex.co
                points.append(point)
                vertices.append(tuple(point))
                if verify_uv and material == "Custom_Area_Image":
                    expected = (
                        (point.y - AXIAL_MIN) / (AXIAL_MAX - AXIAL_MIN),
                        (math.atan2(point.z, point.x) + math.pi / 2) / math.pi,
                    )
                    actual = uv.data[index].uv
                    uv_errors.append(max(abs(actual[0] - expected[0]), abs(actual[1] - expected[1])))
            triangles.append((material, vertices))
    bounds = {
        "min": [min(p[i] for p in points) for i in range(3)],
        "max": [max(p[i] for p in points) for i in range(3)],
    }
    return {"bounds": bounds, "triangles": triangles, "uv_errors": uv_errors}


def same_triangles(original, generated, tolerance=0.001):
    """Match triangle vertices by spatial tolerance, independent of ordering."""
    positions = {}
    for material, vertices in original:
        bucket = positions.setdefault(material, {})
        for vertex in vertices:
            key = tuple(round(component, 6) for component in vertex)
            if key not in bucket:
                bucket[key] = len(bucket)
    trees = {}
    for material, vertices in positions.items():
        tree = KDTree(len(vertices))
        for point, index in vertices.items():
            tree.insert(point, index)
        tree.balance()
        trees[material] = tree
    def triangle_ids(triangles):
        result = Counter()
        for material, vertices in triangles:
            tree = trees.get(material)
            if tree is None:
                return None
            indices = []
            for point in vertices:
                _, index, distance = tree.find(point)
                if distance > tolerance:
                    return None
                indices.append(index)
            result[(material, tuple(sorted(indices)))] += 1
        return result
    original_ids = triangle_ids(original)
    generated_ids = triangle_ids(generated)
    return original_ids is not None and generated_ids is not None and original_ids == generated_ids


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    report = []
    passed = True
    for name in NAMES:
        original = load(ROOT / "assets" / name, False)
        generated = load(ROOT / "assets" / "generated" / name, True)
        max_bound_error = max(
            abs(original["bounds"][side][i] - generated["bounds"][side][i])
            for side in ("min", "max") for i in range(3)
        )
        item = {
            "file": name,
            "triangle_count_original": len(original["triangles"]),
            "triangle_count_generated": len(generated["triangles"]),
            "triangles_unchanged_at_0.001_mm": same_triangles(original["triangles"], generated["triangles"]),
            "max_bounds_error_mm": max_bound_error,
            "checked_image_uv_loops": len(generated["uv_errors"]),
            "max_uv_error": max(generated["uv_errors"], default=None),
        }
        report.append(item)
        if (not item["triangles_unchanged_at_0.001_mm"]
                or max_bound_error > 0.1
                or not item["checked_image_uv_loops"]
                or item["max_uv_error"] > 1e-5):
            passed = False
    (OUTPUT / "uv-verification.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("UV_VERIFICATION", json.dumps(report))
    if not passed:
        raise RuntimeError("Calibration verification failed; see uv-verification.json")


if __name__ == "__main__":
    main()
