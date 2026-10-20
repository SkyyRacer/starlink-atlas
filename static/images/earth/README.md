# NASA Earth composites

Optional realistic rendering textures; downloaded once on activation and cached locally by the rendering service worker. These are composites, not current weather or a historic satellite photograph. The day/night terminator uses the simulation date, not the source image date.

- `day.webp`: NASA Blue Marble, land / shallow water / shaded topography. Reto Stöckli, NASA GSFC / MODIS. Original (2048×1024): https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57752/land_shallow_topo_2048.jpg
- `night.webp`: NASA Earth Observatory Black Marble 2016 color composite (3600×1800). Original: https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg — https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/
- `clouds.webp`: NASA Blue Marble cloud composite, Reto Stöckli / MODIS (2048×1024). Original: https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg

Converted to WebP, no generated geography, names, borders or invented city lights. Total transfer approximately 1.23 MB. The clouds are a separate map composited in the globe material. Atmospheric limb uses Cesium's physical scattering model. Public NASA imagery usage: https://www.nasa.gov/nasa-brand-center/images-and-media/

## Higher resolution revision

- `day-4k.webp`: 4096×2048, derived from the genuine 8192×4096 NASA land/shallow-water/topography texture: https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57752/land_shallow_topo_8192.tif
- `night-4k.webp`: 4096×2048, derived from the 13500×6750 Black Marble original: https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg

The new file names avoid serving the older low-resolution images from the asset cache. The atmosphere uses shorter density scale heights; the added night airglow is an illustrative narrow green limb, not a live aurora observation.

- `clouds-4k.webp`: 4096×2048, from the original 8192×4096 NASA MODIS cloud composite: https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_8192.tif
