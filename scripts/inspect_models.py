"""Inspect the four legacy models without changing their source files.

Run with:
  blender --background --factory-startup --python scripts/inspect_models.py

The report and work file are written to output/blender/. Source dimensions are
legacy glTF units; the web application treats one legacy unit as one millimetre.
"""
import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree


ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "output" / "blender"
ASSETS = (
    "Dizi_Display.glb",
    "Part_1_Printable.glb",
    "Part_2_Printable.glb",
    "Part_3_Printable_Source.glb",
)
EXPECTED_SIZES = {
    "Dizi_Display.glb": (25.0, 642.4, 25.0),
    "Part_1_Printable.glb": (24.987, 259.133, 24.997),
    "Part_2_Printable.glb": (25.0, 270.867, 25.0),
    "Part_3_Printable_Source.glb": (25.0, 142.4, 25.0),
}


def bounds(objects):
    points = [
        obj.matrix_world @ Vector(corner)
        for obj in objects if obj.type == "MESH"
        for corner in obj.bound_box
    ]
    if not points:
        return None
    minimum = [min(point[i] for point in points) for i in range(3)]
    maximum = [max(point[i] for point in points) for i in range(3)]
    return {
        "min": minimum,
        "max": maximum,
        "size": [maximum[i] - minimum[i] for i in range(3)],
    }


def inspect_mesh(obj):
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.edges.ensure_lookup_table()
    non_manifold = sum(not edge.is_manifold for edge in bm.edges)
    boundary = sum(edge.is_boundary for edge in bm.edges)
    loose = sum(edge.is_wire for edge in bm.edges)
    degenerate = sum(face.calc_area() < 1e-10 for face in bm.faces)
    # glTF splits vertices at UV/material boundaries. Audit a temporary welded
    # copy as well so those seams are not mistaken for physical holes.
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-5)
    welded_non_manifold = sum(not edge.is_manifold for edge in bm.edges)
    welded_boundary = sum(edge.is_boundary for edge in bm.edges)
    bm.free()

    uv_layer = mesh.uv_layers.active
    material_uv = {}
    if uv_layer:
        for face in mesh.polygons:
            material = (obj.material_slots[face.material_index].name
                        if face.material_index < len(obj.material_slots)
                        else "(none)")
            values = material_uv.setdefault(material, [])
            values.extend(uv_layer.data[i].uv[:] for i in face.loop_indices)
    uv_bounds = {}
    for material, values in material_uv.items():
        if values:
            uv_bounds[material] = {
                "min": [min(v[i] for v in values) for i in range(2)],
                "max": [max(v[i] for v in values) for i in range(2)],
                "loops": len(values),
            }
    corner_normals = mesh.corner_normals
    invalid_normals = sum(
        not all(math.isfinite(component) for component in normal.vector)
        or abs(normal.vector.length - 1.0) > 0.01
        for normal in corner_normals
    )
    reversed_corner_normals = sum(
        face.normal.dot(corner_normals[index].vector) < -0.01
        for face in mesh.polygons for index in face.loop_indices
    )

    return {
        "name": obj.name,
        "world_bounds": bounds([obj]),
        "location": list(obj.location),
        "scale": list(obj.scale),
        "vertices": len(mesh.vertices),
        "faces": len(mesh.polygons),
        "materials": [slot.name for slot in obj.material_slots],
        "uv_layers": [layer.name for layer in mesh.uv_layers],
        "uv_bounds_by_material": uv_bounds,
        "non_manifold_edges": non_manifold,
        "boundary_edges": boundary,
        "welded_non_manifold_edges": welded_non_manifold,
        "welded_boundary_edges": welded_boundary,
        "loose_edges": loose,
        "degenerate_faces": degenerate,
        "invalid_corner_normals": invalid_normals,
        "reversed_corner_normals": reversed_corner_normals,
    }


def build_bvh(objects):
    vertices, polygons = [], []
    for obj in objects:
        if obj.type != "MESH":
            continue
        offset = len(vertices)
        vertices.extend(obj.matrix_world @ vertex.co for vertex in obj.data.vertices)
        obj.data.calc_loop_triangles()
        polygons.extend(tuple(offset + index for index in triangle.vertices)
                        for triangle in obj.data.loop_triangles)
    return BVHTree.FromPolygons(vertices, polygons, all_triangles=True)


def axial_hits(tree, box):
    start = box["min"][1] - 1.0
    end = box["max"][1] + 1.0
    origin = Vector((0, start, 0))
    direction = Vector((0, 1, 0))
    hits = []
    while origin.y < end and len(hits) < 20:
        location, _, _, _ = tree.ray_cast(origin, direction, end - origin.y)
        if location is None:
            break
        hits.append(location.y)
        origin = location + direction * 0.001
    return hits


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    report = {
        "blender_version": bpy.app.version_string,
        "source_units": "legacy units, assumed mm",
        "assets": [],
    }
    trees = {}
    boxes = {}
    for name in ASSETS:
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(ROOT / "assets" / name))
        objects = [obj for obj in bpy.data.objects if obj not in before]
        bpy.context.view_layer.update()
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
        for obj in objects:
            for existing in list(obj.users_collection):
                existing.objects.unlink(obj)
            collection.objects.link(obj)
        box = bounds(objects)
        tree = build_bvh(objects)
        trees[name] = tree
        boxes[name] = box
        mesh_reports = [inspect_mesh(obj) for obj in objects if obj.type == "MESH"]
        size_error = max(abs(box["size"][i] - EXPECTED_SIZES[name][i]) for i in range(3))
        needs_review = size_error > 0.1 or any(
            mesh["welded_non_manifold_edges"] or mesh["degenerate_faces"]
            or mesh["invalid_corner_normals"] or mesh["reversed_corner_normals"] for mesh in mesh_reports
        )
        report["assets"].append({
            "file": name,
            "world_bounds": box,
            "baseline_size_error_mm": size_error,
            "geometry_status": "needs-review" if needs_review else "geometry-checked",
            "physical_fit_status": "not-verified",
            "centerline_surface_hits": axial_hits(tree, box),
            "objects": mesh_reports,
        })
        collection.hide_viewport = name != "Dizi_Display.glb"
        collection.hide_render = name != "Dizi_Display.glb"
    report["assembly"] = []
    for first, second in zip(ASSETS[1:3], ASSETS[2:4]):
        overlap = max(0, min(boxes[first]["max"][1], boxes[second]["max"][1])
                      - max(boxes[first]["min"][1], boxes[second]["min"][1]))
        report["assembly"].append({
            "parts": [first, second],
            "axial_bounds_overlap_mm": overlap,
            "intersecting_triangle_pairs": len(trees[first].overlap(trees[second])),
        })
    report_path = OUTPUT / "model-report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT / "model-inspection.blend"))
    print("INSPECTION_REPORT", report_path)


if __name__ == "__main__":
    main()
