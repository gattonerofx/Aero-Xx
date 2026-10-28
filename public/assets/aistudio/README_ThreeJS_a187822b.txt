VOLCANIC BASALT PBR MAPS — Three.js
======================================
Files are 2048x2048 PNG textures derived from the generated basalt albedo.
They are useful starter maps, not scanned / artist-authored ground-truth maps.

Maps:
- volcanic_basalt_albedo.png      Base color (sRGB)
- volcanic_basalt_normal.png      Tangent-space normal map
- volcanic_basalt_roughness.png   Roughness (linear grayscale; white = rough)
- volcanic_basalt_height.png      Height / displacement (grayscale)
- volcanic_basalt_ao.png          Approximate ambient occlusion (white = unoccluded)
- volcanic_basalt_metallic.png    Metallic (basalt should remain mostly non-metallic)
- volcanic_basalt_emissive.png    Approximate warm mineral/lava emissive extraction
- volcanic_basalt_lava_mask.png   Grayscale mask for blending a separate lava material

Three.js notes:
- Set albedo.colorSpace = THREE.SRGBColorSpace.
- Keep normal/roughness/height/ao/metallic/mask maps in linear color space (default NoColorSpace).
- For a standard material: map, normalMap, roughnessMap, aoMap, metalnessMap, emissiveMap.
- Set material.emissive = new THREE.Color(1.0, 0.18, 0.015) and tune emissiveIntensity.
- For displacementMap, the mesh needs enough subdivisions; start with displacementScale around 0.03–0.12
  in your scene's world units. Avoid strong displacement on distant mountain meshes.
- AO map on BufferGeometry typically needs a second UV channel (uv1); duplicate uv into uv1 if needed.
- Use RepeatWrapping and set repeat consistently on every map. Use anisotropy up to renderer.capabilities.getMaxAnisotropy().
- These maps are generated from albedo heuristics. For production-grade realism, replace with authored/scanned PBR maps.
