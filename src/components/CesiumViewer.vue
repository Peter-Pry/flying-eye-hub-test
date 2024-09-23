<template>
    <div id="cesiumContainer" class="h-96 w-full"></div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch } from 'vue';
import { Ion, Viewer, Cartesian3, HeadingPitchRoll, Math as CesiumMath, Color, Transforms, LabelStyle, VerticalOrigin, Cartesian2, PolylineGraphics, Entity } from 'cesium';
import "cesium/Build/Cesium/Widgets/widgets.css";

// Ajouter ton token Cesium ion ici
Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwMDBlNGRjYy1kNzQ3LTQxNDUtYmU0Mi05Y2FmMWIwNWI4NWUiLCJpZCI6MjQzNDM4LCJpYXQiOjE3MjcwODc2NjF9.kY7ZKkYssmYJvjTnrfER2s68vGRzWcx-6yc5HYHWRwY';

// Fonction pour valider les coordonnées du drone
function isValidCoordinate(coord) {
    return coord !== undefined && !isNaN(coord);
}

// Fonction pour vérifier que la position est valide
function isValidPosition(position) {
    return (
        position &&
        isValidCoordinate(position.longitude) &&
        isValidCoordinate(position.latitude) &&
        isValidCoordinate(position.height)
    );
}

// Fonction pour calculer les bornes de la vue
function calculateBounds(records) {
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    records.forEach(step => {
        if (isValidPosition(step)) {
            minLat = Math.min(minLat, step.latitude);
            maxLat = Math.max(maxLat, step.latitude);
            minLon = Math.min(minLon, step.longitude);
            maxLon = Math.max(maxLon, step.longitude);
        }
    });
    return { minLat, maxLat, minLon, maxLon };
}

// Fonction pour ajuster la vue globale et orientée avec offset
function adjustCameraView(records) {
    const bounds = calculateBounds(records);
    const centerLon = (bounds.minLon + bounds.maxLon) / 2;
    const centerLat = (bounds.minLat + bounds.maxLat) / 2 - 0.008;

    // Définir l'altitude (au lieu de 10 000, tu peux réduire pour mieux voir)
    const altitude = 500; // Distance de la caméra

    // Ajustement de la vue globale avec un angle de 45° (heading au nord, pitch vers le bas)
    viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(centerLon, centerLat, altitude),
        orientation: {
            heading: CesiumMath.toRadians(0),    // 0 pour nord
            pitch: CesiumMath.toRadians(-25),    // Inclinaison à 45 degrés
            roll: 0
        }
    });
}

// Fonction pour tracer les flèches de déplacement
function createFlightPathWithArrows(records) {
    const positions = records.map(step => Cartesian3.fromDegrees(step.longitude, step.latitude, step.height || 100));

    // Ajouter une ligne polyline classique
    viewer.entities.add({
        polyline: {
            positions: positions,
            width: 3,
            material: Color.WHITE, // Utiliser du blanc pour simuler une flèche
        }
    });
}

// Fonction pour ajouter des étapes numérotées sur la trajectoire
function addStepLabels(records) {
    records.forEach((step, index) => {
        const position = Cartesian3.fromDegrees(step.longitude, step.latitude, step.height || 100);
        viewer.entities.add({
            position: position,
            label: {
                text: (index + 1).toString(), // Numérotation des étapes
                font: '20px sans-serif',
                fillColor: Color.YELLOW,
                outlineColor: Color.BLACK,
                outlineWidth: 2,
                style: LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: VerticalOrigin.BOTTOM,
                pixelOffset: new Cartesian2(0, -10)
            }
        });
    });
}

// Fonction pour créer le cône de vision d'une étape spécifique
function createVisionCone(step) {
    if (isValidPosition(step)) {
        const position = Cartesian3.fromDegrees(step.longitude, step.latitude, step.height || 100);
        const heading = CesiumMath.toRadians(step.attitude_head || 0); // Cap
        const pitch = CesiumMath.toRadians(step.attitude_pitch || 0);  // Inclinaison
        const roll = CesiumMath.toRadians(step.attitude_roll || 0);    // Roulement

        const orientation = Transforms.headingPitchRollQuaternion(
            position, new HeadingPitchRoll(heading, pitch, roll)
        );

        // Ajout d'un cône de vision pour l'étape sélectionnée
        viewer.entities.add({
            position: position,
            orientation: orientation,
            cylinder: {
                length: 100.0,               // Longueur du cône
                topRadius: 0.0,              // Rayon en haut du cône
                bottomRadius: 50.0,          // Rayon à la base du cône (zone de vision)
                material: Color.GREEN.withAlpha(0.3), // Cône transparent
                outline: true,
                outlineColor: Color.WHITE,
            }
        });
    }
}

// Fonction pour que la caméra suive la position courante avec lookAt
function lookAtCurrentStep(step) {
    if (isValidPosition(step)) {
        const position = Cartesian3.fromDegrees(step.longitude, step.latitude, step.height || 100);

        // Distance de la caméra pour voir le drone
        const offset = new Cartesian3(-50, -250, 100); // Ajuster cette valeur si nécessaire

        // Regarder la position actuelle avec un décalage (offset) pour avoir une bonne vue d'ensemble
        viewer.camera.lookAt(position, offset);
    }
}

// Initialisation de Cesium
let viewer;
const props = defineProps({
    flightRecords: {
        type: Array,
        required: true
    },
    currentStepIndex: {
        type: Number,
        required: true
    }
});

onMounted(() => {
    viewer = new Viewer('cesiumContainer', {
        shouldAnimate: true  // Activer l'animation
    });

    // Ajustement de la vue pour inclure toutes les étapes
    adjustCameraView(props.flightRecords);

    // Trajectoire avec flèches blanches
    createFlightPathWithArrows(props.flightRecords);

    // Numérotation des étapes
    addStepLabels(props.flightRecords);

    // Afficher le cône de vision uniquement pour l'étape actuelle
    if (props.flightRecords[props.currentStepIndex]) {
        createVisionCone(props.flightRecords[props.currentStepIndex]);
        lookAtCurrentStep(props.flightRecords[props.currentStepIndex]); // Suivre la position courante
    }
});

// Surveiller les changements de l'étape actuelle pour mettre à jour le cône de vision et le lookAt
watch(() => props.currentStepIndex, (newIndex) => {
    // Supprimer toutes les entités avant d'ajouter le cône de l'étape actuelle
    viewer.entities.removeAll();

    // Réafficher la trajectoire, les flèches et les labels
    createFlightPathWithArrows(props.flightRecords);
    addStepLabels(props.flightRecords);

    // Afficher le cône de vision uniquement pour l'étape en cours
    if (props.flightRecords[newIndex]) {
        createVisionCone(props.flightRecords[newIndex]);
        lookAtCurrentStep(props.flightRecords[newIndex]); // Suivre la position courante
    }
});

onBeforeUnmount(() => {
    if (viewer) {
        viewer.destroy();
    }
});
</script>

<style scoped>
@import 'cesium/Build/Cesium/Widgets/widgets.css';

#cesiumContainer {
    width: 100%;
    height: 500px;
}
</style>
