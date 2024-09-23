<template>
    <div id="cesiumContainer" style="width: 100%; height: 100vh;"></div>
</template>

<script>
import { onMounted } from 'vue';
import {
    Cartesian3,
    Math as CesiumMath,
    Terrain,
    Viewer,
    createOsmBuildingsAsync,
    ScreenSpaceEventType,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

export default {
    name: 'CesiumMap',
    setup() {
        onMounted(() => {
            // Initialize the Cesium Viewer in the HTML element with the `cesiumContainer` ID.
            const viewer = new Viewer("cesiumContainer", {
                terrain: Terrain.fromWorldTerrain(),
            });

            // Fly the camera to San Francisco at the given longitude, latitude, and height.
            viewer.camera.setView({
                destination: {
                    x: 4589522.716571591,
                    y: 569625.6565312466,
                    z: 4377875.571177211,
                },
                orientation: {
                    heading: 0.03700982330266278,
                    pitch: -0.414427091968657,
                },
            });

            // Add Cesium OSM Buildings, a global 3D buildings layer.
            createOsmBuildingsAsync().then((buildingTileset) => {
                viewer.scene.primitives.add(buildingTileset);
            });
        });
    },
};
</script>

<style scoped>
@import 'cesium/Build/Cesium/Widgets/widgets.css';
</style>
