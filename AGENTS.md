# City asset workflow

- The user wants internet references consulted before building or substantially rebuilding objects. Record useful sources and the construction details used in `reference/asset-references.md`.
- Author city objects in Blender and retain editable source assets. Use shaped meshes, meaningful joinery and PBR texture maps; avoid placeholder stacks of uniform-colour boxes, disks and rods.
- Build continuous architectural envelopes with real door/window openings. Avoid disconnected wall blocks, unintended seams and applied cylindrical ornaments without a clear architectural purpose. Separate parts should express intentional construction joints.
- Fit coping, frames, roofs and canopies to the actual adjoining contours. Boolean recesses must not cut into neighbouring towers or structural parts. Check both connected, manifold geometry and the intended exterior silhouette; manifold meshes can still contain unwanted recesses.
- Preserve explicitly approved features when redesigning adjacent parts. Keep geometry fingerprints or equivalent checks for those features where practical.
- Preserve the detailed cartoon miniature direction, human-scale proportions, existing composition and animation unless the user requests a change.
- Keep all people and Chinese lettering out of the city.
- Keep ground paving continuous and flush, with no drain slots or slotted grates.
- Keep roads free of separate kerb blocks. Asphalt is recessed 16 cm below the continuous pedestrian paving, with softened edges and dropped crossings.
- Place furniture according to its use: harbour benches face the water; lamps stay clear of traffic; lifts have protected machinery, visible enclosure and doors aligned with their landings; rail and tree beds are recessed rather than mounted on extra plinths.
- Check light continuity across interiors, glazing, ceilings and reveals in the actual browser at night. A luminous back rectangle is not a complete lit room.
- Inspect changed assets close up from the front, sides and rear, in daylight and at night. Check joins, intersections, trim terminations and furniture placement; add targeted regression checks for defects found during inspection.
- Rebuild using `tools/blender/build_neighborhood.py` and `finish_assets.py`; validate geometry and GLBs, run `npm test` and `npm run build`, and inspect the affected objects in the browser before reporting completion.
