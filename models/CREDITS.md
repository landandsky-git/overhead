# 3D models

- `iss.glb`: "International Space Station (ISS) (B)", NASA 3D Resources
  (https://science.nasa.gov/3d-resources/international-space-station-iss-b/)
- `hubble.glb`: "Hubble Space Telescope (A)", NASA 3D Resources
  (https://science.nasa.gov/3d-resources/hubble-space-telescope-a/)
- `coastline.json`: coastlines for the 3D globe, from Natural Earth's 1:110m coastline
  (https://www.naturalearthdata.com/, public domain), rounded to 0.1°.

NASA 3D Resources are free to download and use; see NASA's media usage guidelines
(https://www.nasa.gov/nasa-brand-center/images-and-media/).

The files are unchanged from NASA's downloads, which come already compressed (Draco geometry, and
WebP textures for Hubble). When showing the ISS, the app leaves out seven stray parts of the file
that float about 40 m above the station (see `js/model-detail.js`). There is no free model of the Tiangong station, so it keeps the app's
simplified one.

The 3D library in `lib/three` is three.js r170 (MIT license, see `lib/three/LICENSE`).
