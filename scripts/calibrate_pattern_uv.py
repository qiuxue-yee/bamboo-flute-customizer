"""Put the two existing image surfaces into one shared physical UV frame.

Run in a background Blender:
  blender --background --factory-startup --python scripts/calibrate_pattern_uv.py

Only UV coordinates of Custom_Area_Image are changed. The source GLBs remain
untouched; generated GLBs and editable Blender work files are written separately.
"""
import json
import math
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "output" / "blender"
GENERATED = ROOT / "assets" / "generated"
ASSETS = ("Dizi_Display.glb", "Part_3_Printable_Source.glb")
# Both source meshes place the image area at the same axial positions. These
# coordinates are in the imported Blender world frame, still in legacy units.
AXIAL_MIN = -612.4
AXIAL_MAX = -541.2


def calibrate():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    GENERATED.mkdir(parents=True, exist_ok=True)
    result = []
    for filename in ASSETS:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(ROOT / "assets" / filename))
        bpy.context.view_layer.update()
        modified_loops = 0
        for obj in bpy.context.scene.objects:
            if obj.type != "MESH":
                continue
            uv = obj.data.uv_layers.active
            if not uv:
                raise RuntimeError(f"{filename}: missing UV layer")
            for face in obj.data.polygons:
                material = obj.material_slots[face.material_index].material
                if not material or material.name != "Custom_Area_Image":
                    continue
                for loop_index in face.loop_indices:
                    vertex = obj.data.vertices[obj.data.loops[loop_index].vertex_index]
                    point = obj.matrix_world @ vertex.co
                    along = (point.y - AXIAL_MIN) / (AXIAL_MAX - AXIAL_MIN)
                    around = (math.atan2(point.z, point.x) + math.pi / 2) / math.pi
                    uv.data[loop_index].uv = (along, around)
                    modified_loops += 1
            obj.data.update()
        if not modified_loops:
            raise RuntimeError(f"{filename}: image material was not found")
        output = GENERATED / filename
        bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT / (output.stem + "-uv.blend")))
        bpy.ops.export_scene.gltf(
            filepath=str(output),
            export_format="GLB",
            export_yup=True,
        )
        result.append({"source": filename, "generated": str(output), "modified_uv_loops": modified_loops})
    (OUTPUT / "uv-calibration.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print("UV_CALIBRATION", json.dumps(result))


if __name__ == "__main__":
    calibrate()
