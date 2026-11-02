"""Reimport the browser-exported part in Blender and compare GLB/STL coordinates."""
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "output" / "blender"


def bounds(objects):
    points = [obj.matrix_world @ Vector(corner) for obj in objects if obj.type == "MESH" for corner in obj.bound_box]
    if not points:
        raise RuntimeError("Imported file has no meshes")
    return {
        "min_m": [min(point[i] for point in points) for i in range(3)],
        "max_m": [max(point[i] for point in points) for i in range(3)],
    }


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    glb_path = ROOT / "output" / "playwright" / "verified-part3.glb"
    stl_path = ROOT / "output" / "playwright" / "verified-part3.stl"
    if not glb_path.exists() or not stl_path.exists():
        raise RuntimeError("Run the Playwright GLB/STL export test first")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(glb_path))
    bpy.context.view_layer.update()
    glb_objects = list(bpy.context.scene.objects)
    glb_bounds = bounds(glb_objects)
    images = [{"name": image.name, "size": list(image.size), "packed": bool(image.packed_file)}
              for image in bpy.data.images if image.size[0] and image.size[1]]
    before = set(bpy.data.objects)
    # Three.js STL coordinates are y-up and numeric mm. Convert orientation on
    # import and scale the isolated inspection copy to metres for comparison.
    bpy.ops.wm.stl_import(filepath=str(stl_path), forward_axis="NEGATIVE_Z", up_axis="Y")
    stl_objects = [obj for obj in bpy.data.objects if obj not in before]
    for obj in stl_objects:
        obj.scale *= 0.001
    bpy.context.view_layer.update()
    stl_bounds = bounds(stl_objects)
    max_error_mm = max(
        abs(glb_bounds[side][axis] - stl_bounds[side][axis]) * 1000
        for side in ("min_m", "max_m") for axis in range(3)
    )
    result = {
        "glb": glb_bounds,
        "stl_converted_to_m": stl_bounds,
        "max_coordinate_error_mm": max_error_mm,
        "embedded_images": images,
        "passed": max_error_mm <= 0.1 and bool(images),
    }
    (OUTPUT / "export-roundtrip.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT / "export-roundtrip.blend"))
    print("EXPORT_ROUNDTRIP", json.dumps(result))
    if not result["passed"]:
        raise RuntimeError("GLB/STL round-trip verification failed")


if __name__ == "__main__":
    main()
