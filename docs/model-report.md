# Blender model inspection · 模型检查报告

Inspection performed with Blender 5.2.2 LTS on 2026-10-30. Source coordinates
are treated as millimetres for this software migration; no physical measurement
was available to establish the original authoring units.

## Dimensions and topology

Measurements below are in the original shared assembly frame. Vertices split
at UV and material seams were temporarily welded at 0.00001 mm for the
topology check; the original files were not altered.

| Asset | Longest dimension | Cross-section | Boundary edges after welding | Other non-manifold edges |
| --- | ---: | ---: | ---: | ---: |
| Display | 642.400 mm | 25.000 × 25.000 mm | 0 | 3 |
| Part 1 | 259.133 mm | 24.987 × 24.997 mm | 0 | 0 |
| Part 2 | 270.867 mm | 25.000 × 25.000 mm | 0 | 0 |
| Part 3 | 142.400 mm | 25.000 × 25.000 mm | 0 | 0 |

No degenerate faces, invalid corner normals or reversed corner normals were
found. These checks do not establish printability.
The display mesh's three non-manifold edges remain unresolved and are not
treated as a passed manufacturing check.

## Assembly and bore

The bounding boxes of each adjacent pair overlap axially by 15 mm. Boolean
intersection of temporary welded copies measured approximately **2.031 mm³**
for parts 1–2 and **0.596 mm³** for parts 2–3. These small intersections need
inspection and a physical fit test; the joints are **not marked as verified**.
The source geometry and clearances were not changed.

A centerline ray found four surface intersections in part 1, at approximately
-35.013, -21.000, -3.000 and 0.000 mm in Blender's imported axial frame. It
found no centerline intersections in parts 2 and 3. The function of the part 1
surfaces and full bore continuity require review; a centerline ray alone cannot
establish whether the instrument is playable.

## Image UV calibration

The display and part 3 source image areas originally used different UV
coordinates, including values far outside 0–1 on part 3. The generated copies
map the image areas to the same axial position and circumferential angle.
Only image-area UV coordinates were edited.

After export and reimport, the generated meshes retained the original triangle
geometry to 0.001 mm spatial matching tolerance. Maximum bounding-coordinate
difference was 0.000122 mm; maximum checked UV error was 0.00000264. A Blender
render compares the two surfaces with the same grid, arrow and text:
`output/blender/uv-comparison.png`.

The browser-exported patterned GLB and STL were also reimported in Blender.
Their maximum corresponding bounding-coordinate difference was 0.000060 mm;
the GLB contained packed 2048 × 512 bamboo and 1024 × 565 pattern images. The
visual update changes derived UVs and materials, not vertex coordinates or
manufacturing geometry. These are software round-trip
checks, not measurements of a printed instrument.

## Reproduce

The commands in the project README recreate the source inspection, assembly
intersection check, UV calibration, comparison render and export round-trip
report. Detailed JSON and editable Blender files are placed under
`output/blender/`.
