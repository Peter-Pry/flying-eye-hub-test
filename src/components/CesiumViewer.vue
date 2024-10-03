<template>
    <div id="cesiumContainer" class="h-96 w-full"></div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch } from 'vue';
import { Cartographic, sampleTerrainMostDetailed, PolylineArrowMaterialProperty, PolylineGlowMaterialProperty, createOsmBuildingsAsync, Ion, Viewer, Cartesian3, HeadingPitchRoll, Math as CesiumMath, Color, Transforms, LabelStyle, VerticalOrigin, Cartesian2, PolylineGraphics, Entity, CesiumTerrainProvider, Terrain } from 'cesium';
import "cesium/Build/Cesium/Widgets/widgets.css";

// Ajouter ton token Cesium ion ici
Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwMDBlNGRjYy1kNzQ3LTQxNDUtYmU0Mi05Y2FmMWIwNWI4NWUiLCJpZCI6MjQzNDM4LCJpYXQiOjE3MjcwODc2NjF9.kY7ZKkYssmYJvjTnrfER2s68vGRzWcx-6yc5HYHWRwY';

let currentConeEntity = null; // Variable pour stocker le cône actuel
let currentDroneEntity = null;
let currentConeObjet = null;
let positionsWithAltitudes = []; // Variable pour stocker les positions avec altitude


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

// Fonction pour calculer les positions avec les altitudes relatives
async function calculatePositionsWithAltitude(records) {
    if (records.length === 0) {
        console.error("No records available");
        return [];
    }

    // Convertir les positions en Cartographic pour obtenir les altitudes du terrain
    const cartographics = records.map(step => Cartographic.fromDegrees(step.longitude, step.latitude));

    // Obtenir les altitudes du terrain pour le premier point (dock)
    const updatedPositions = await sampleTerrainMostDetailed(viewer.terrainProvider, cartographics);

    // Récupérer l'altitude du terrain du dock (premier point)
    const dockAltitude = updatedPositions[0].height;

    // Traiter les positions avec l'altitude réelle du dock et des altitudes relatives pour les autres étapes
    positionsWithAltitudes = updatedPositions.map((cartographic, index) => {
        const step = records[index];

        // // Appliquer la correction d'orientation pour heading, pitch et roll
        // const correctedAttitude = applyOrientationCorrection({
        //     heading: step.attitude_head,
        //     pitch: step.attitude_pitch,
        //     roll: step.attitude_roll
        // });

        // Calculer les altitudes relatives par rapport à la première position (dock)
        const relativeAltitude = dockAltitude + (step.height || 0); // Altitude relative par rapport au dock

        return {
            position: Cartesian3.fromDegrees(
                CesiumMath.toDegrees(cartographic.longitude),
                CesiumMath.toDegrees(cartographic.latitude),
                relativeAltitude
            ),
            step: {
                ...step,  // Garder les autres propriétés de l'étape
                attitude_head: positionsWithAltitudes.heading,   // Utiliser les valeurs corrigées
                attitude_pitch: positionsWithAltitudes.pitch,
                attitude_roll: positionsWithAltitudes.roll
            }
        };
    });

    return positionsWithAltitudes;
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
    const centerLat = (bounds.minLat + bounds.maxLat) / 2;
    const offsetLat = - 0.006
    // Définir l'altitude (au lieu de 10 000, tu peux réduire pour mieux voir)
    const altitude = 500; // Distance de la caméra

    // Ajustement de la vue globale avec un angle de 45° (heading au nord, pitch vers le bas)
    viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(centerLon, centerLat + offsetLat, altitude),
        orientation: {
            heading: CesiumMath.toRadians(0),    // 0 pour nord
            pitch: CesiumMath.toRadians(-25),    // Inclinaison à 45 degrés
            roll: 0
        },
        duration: 1
    });
}

// Fonction pour tracer les flèches de déplacement avec ajustement relatif à la position du dock
async function createFlightPathWithArrows(records) {
    if (records.length === 0) {
        console.error("No records available");
        return;
    }

    // Convertir les positions en Cartographic pour obtenir les altitudes du terrain
    const cartographics = records.map(step => Cartographic.fromDegrees(step.longitude, step.latitude));

    // Obtenir l'altitude du terrain pour le premier point (dock)
    const updatedPositions = await sampleTerrainMostDetailed(viewer.terrainProvider, [cartographics[0]]);

    // Récupérer l'altitude du terrain du dock (premier point)
    const dockAltitude = updatedPositions[0].height;
    const dockStep = records[0];

    // Traiter les positions avec l'altitude réelle du dock et des altitudes relatives pour les autres étapes
    const positions = records.map((step, index) => {
        if (index === 0) {
            // Utiliser l'altitude réelle du terrain pour le premier point
            return Cartesian3.fromDegrees(step.longitude, step.latitude, dockAltitude);
        }

        // Calculer les altitudes relatives par rapport à la première position (dock)
        const relativeAltitude = dockAltitude + (step.height || 0); // Altitude relative par rapport au dock

        return Cartesian3.fromDegrees(

            step.longitude,
            step.latitude,
            relativeAltitude // Utiliser l'altitude relative
        );
    });

    // Ajouter une polyline avec des flèches blanches pointant vers le point suivant
    viewer.entities.add({
        polyline: {
            positions: positions,
            width: 3,
            material: new PolylineArrowMaterialProperty(Color.WHITE), // Utiliser le matériau de flèche blanche
            clampToGround: false // S'assurer que la polyline n'est pas collée au sol si nécessaire
        }
    });
}

// Fonction pour dessiner des flèches distinctes entre chaque étape
async function createDistinctFlightArrows(records) {
    // const positionsWithAltitudes = await calculatePositionsWithAltitude(records);

    // positionsWithAltitudes.forEach((data, index) => {
    //     if (index < positionsWithAltitudes.length - 1) {
    //         const nextPosition = positionsWithAltitudes[index + 1].position;

    //         viewer.entities.add({
    //             polyline: {
    //                 positions: [data.position, nextPosition],
    //                 width: 3,
    //                 material: new PolylineArrowMaterialProperty(Color.WHITE), // Utiliser le matériau de flèche blanche
    //                 clampToGround: false // S'assurer que la polyline n'est pas collée au sol si nécessaire
    //             }
    //         });
    //     }
    // });
    positionsWithAltitudes.forEach((data, index) => {
        if (index < positionsWithAltitudes.length - 1) {
            const nextPosition = positionsWithAltitudes[index + 1].position;

            viewer.entities.add({
                polyline: {
                    positions: [data.position, nextPosition],
                    width: 7,
                    material: new PolylineArrowMaterialProperty(Color.WHITE), // Utiliser le matériau de flèche blanche
                    clampToGround: false // S'assurer que la polyline n'est pas collée au sol si nécessaire
                }
            });
        }
    });
}


// Fonction pour ajouter des étapes numérotées sur la trajectoire
async function addStepLabels(records) {
    // // Convertir les positions en Cartographic pour obtenir les altitudes du terrain
    // const cartographics = records.map(step => Cartographic.fromDegrees(step.longitude, step.latitude));

    // // Obtenir les altitudes du terrain pour chaque point
    // const updatedPositions = await sampleTerrainMostDetailed(viewer.terrainProvider, cartographics);

    // updatedPositions.forEach((cartographic, index) => {
    //     const step = records[index]; // Récupérer l'étape actuelle

    //     // Ajouter l'altitude du drone à l'altitude du terrain
    //     const altitude = cartographic.height + (step.height || 0); // Ajoute step.height s'il est défini

    //     const position = Cartesian3.fromDegrees(
    //         CesiumMath.toDegrees(cartographic.longitude),
    //         CesiumMath.toDegrees(cartographic.latitude),
    //         altitude // Utiliser l'altitude combinée (terrain + drone)
    //     );

    //     viewer.entities.add({
    //         position: position,
    //         label: {
    //             text: (index + 1).toString(), // Numérotation des étapes
    //             font: '20px sans-serif',
    //             backgroundColor: Color.BLUE,
    //             fillColor: Color.WHITE,
    //             outlineColor: Color.BLACK,
    //             outlineWidth: 2,
    //             style: LabelStyle.FILL_AND_OUTLINE,
    //             verticalOrigin: VerticalOrigin.BOTTOM,
    //             pixelOffset: new Cartesian2(0, -10)
    //         }
    //     });
    // });
    positionsWithAltitudes.forEach((data, index) => {
        viewer.entities.add({
            position: data.position,
            label: {
                text: (index + 1).toString(), // Numérotation des étapes
                font: '20px sans-serif',
                backgroundColor: Color.BLUE,
                fillColor: Color.WHITE,
                outlineColor: Color.BLACK,
                outlineWidth: 2,
                style: LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: VerticalOrigin.BOTTOM,
                pixelOffset: new Cartesian2(0, -10)
            }
        });
    });
}

// Fonction pour ajouter des labels avec un triangle bleu en arrière-plan
async function addStepLabelsWithTriangle() {
    positionsWithAltitudes.forEach((data, index) => {
        // Ajouter un billboard avec une image de triangle
        viewer.entities.add({
            position: data.position,
            billboard: {
                image: '/images/triangle_blue.svg', // Chemin vers l'image du triangle bleu
                scale: 0.2,                        // Taille du triangle
                verticalOrigin: VerticalOrigin.BOTTOM,
                //pixelOffset: new Cartesian2(0, 15), // Ajuster la position par rapport au texte du label
            },
            label: {
                text: (index + 1).toString(),      // Numérotation des étapes
                font: '20px sans-serif',
                fillColor: Color.WHITE,
                outlineColor: Color.BLACK,
                outlineWidth: 2,
                style: LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: VerticalOrigin.BOTTOM,
                pixelOffset: new Cartesian2(0, -15), // Ajuster pour que le label soit au-dessus du triangle
            }
        });
    });
}


// Fonction pour créer un parallélépipède rectangle simulant la vision de la caméra du drone
function createVisionFrustum(step, distance = 100) {
    if (isValidPosition(step)) {
        const position = Cartesian3.fromDegrees(step.longitude, step.latitude, step.height || 100);
        const heading = CesiumMath.toRadians(step.attitude_head || 0); // Cap
        const pitch = CesiumMath.toRadians(step.attitude_pitch || 0);  // Inclinaison
        const roll = CesiumMath.toRadians(step.attitude_roll || 0);    // Roulement

        const orientation = Transforms.headingPitchRollQuaternion(
            position, new HeadingPitchRoll(heading, pitch, roll)
        );

        // Ajouter un parallélépipède rectangle pour simuler la vision du drone
        viewer.entities.add({
            position: position,
            orientation: orientation,
            box: {
                dimensions: new Cartesian3(distance, 50.0, 30.0), // Dimensions du parallélépipède (distance devant le drone, largeur, hauteur)
                material: Color.GREEN.withAlpha(0.3),             // Couleur verte transparente pour la vision
                outline: true,                                   // Bordure visible
                outlineColor: Color.WHITE                        // Bordure blanche
            }
        });
    }
}

// Fonction pour créer le cône de vision d'une étape spécifique, en ajustant avec l'altitude du terrain
async function createVisionCone(step, distance = 200) {
    if (isValidPosition(step)) {
        // Convertir la position du drone en Cartographic pour obtenir l'altitude du terrain
        const cartographic = Cartographic.fromDegrees(step.longitude, step.latitude);

        // Obtenir l'altitude du terrain pour cette position
        const [terrainPosition] = await sampleTerrainMostDetailed(viewer.terrainProvider, [cartographic]);

        // Calculer l'altitude finale en combinant l'altitude du terrain et l'altitude du drone
        const altitude = terrainPosition.height + (step.height || 0) - distance / 2;

        const position = Cartesian3.fromDegrees(step.longitude, step.latitude, altitude); // Inclure l'altitude combinée

        const heading = CesiumMath.toRadians(step.attitude_head || 0); // Cap (heading)
        const pitch = CesiumMath.toRadians(step.attitude_pitch || 0);  // Inclinaison (pitch)
        const roll = CesiumMath.toRadians(step.attitude_roll || 0);    // Roulement (roll)

        const orientation = Transforms.headingPitchRollQuaternion(
            position, new HeadingPitchRoll(heading, pitch, roll)
        );

        //Ajout le modèle 3D d'un drone
        const uri = '/3dmodels/CesiumDrone.glb';
        const droneEntity = viewer.entities.add({
            name: uri,
            position: Cartesian3.fromDegrees(step.longitude, step.latitude, terrainPosition.height + (step.height || 0)),
            orientation: orientation,
            model: {
                uri: uri,
                minimumPixelSize: 128,
                maximumScale: 100,
            },
        });

        // Ajouter un cône de vision pour l'étape sélectionnée, ajusté avec l'altitude
        const coneEntity = viewer.entities.add({
            position: position,
            orientation: orientation,
            cylinder: {
                length: distance,               // Longueur du cône (distance projetée de la vision)
                topRadius: 0.0,                 // Rayon en haut du cône
                bottomRadius: 75.0,             // Rayon à la base du cône (zone de vision)
                material: Color.WHITE.withAlpha(0.3), // Cône transparent
                outline: true,
                outlineColor: Color.GREEN,      // Bordure du cône pour plus de visibilité
                slices: 4                        // Plus de slices pour une forme plus lisse
            }
        });
        return { coneEntity, droneEntity };
    }
}

async function createVisionFrustumWithPolyline(step, distance = 200) {
    if (isValidPosition(step)) {
        // Obtenir la position du drone
        const position = Cartesian3.fromDegrees(step.longitude, step.latitude, step.height || 0);

        const heading = CesiumMath.toRadians(step.attitude_head || 0); // Cap
        const pitch = CesiumMath.toRadians(step.attitude_pitch || 0);  // Inclinaison
        const roll = CesiumMath.toRadians(step.attitude_roll || 0);    // Roulement

        // Calculer l'orientation
        const orientation = Transforms.headingPitchRollQuaternion(
            position, new HeadingPitchRoll(heading, pitch, roll)
        );

        // Points du cône basés sur l'orientation de la caméra
        const frustumDistance = distance; // Distance du cône de vision
        const halfFOV = CesiumMath.toRadians(60 / 2); // Champ de vision de 60° (pour une caméra 1080p)

        // Créer des directions du frustum (avant, gauche, droite, bas)
        const forward = Cartesian3.multiplyByScalar(Cartesian3.fromQuaternion(orientation), frustumDistance, new Cartesian3());
        const right = Cartesian3.multiplyByScalar(Cartesian3.cross(Cartesian3.UNIT_Z, forward, new Cartesian3()), frustumDistance * Math.tan(halfFOV), new Cartesian3());
        const left = Cartesian3.negate(right, new Cartesian3());
        const up = Cartesian3.multiplyByScalar(Cartesian3.cross(forward, right, new Cartesian3()), frustumDistance * Math.tan(halfFOV), new Cartesian3());
        const down = Cartesian3.negate(up, new Cartesian3());

        // Calculer les points du cône de vision
        const forwardPosition = Cartesian3.add(position, forward, new Cartesian3());
        const leftPosition = Cartesian3.add(forwardPosition, left, new Cartesian3());
        const rightPosition = Cartesian3.add(forwardPosition, right, new Cartesian3());
        const upPosition = Cartesian3.add(forwardPosition, up, new Cartesian3());
        const downPosition = Cartesian3.add(forwardPosition, down, new Cartesian3());

        // Créer la polyline pour représenter le frustum
        viewer.entities.add({
            polyline: {
                positions: [
                    position, forwardPosition, // Ligne droite
                    position, leftPosition,    // Gauche
                    position, rightPosition,   // Droite
                    position, upPosition,      // Haut
                    position, downPosition     // Bas
                ],
                width: 2,
                material: Color.YELLOW
            }
        });

        // Ajouter des lignes pour fermer le frustum (reliant les bords)
        viewer.entities.add({
            polyline: {
                positions: [
                    leftPosition, rightPosition,  // Relier les côtés gauche et droit
                    upPosition, downPosition,     // Relier le haut et le bas
                ],
                width: 2,
                material: Color.YELLOW
            }
        });

        return {
            frustumEntity: viewer.entities
        };
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

// Fonction pour ajuster heading, pitch et roll en fonction des corrections fournies
function applyOrientationCorrection(attitude) {
    const corrections = {
        north: { heading: 1.4, pitch: 2.1, roll: 0.9 },
        south: { heading: -177.5, pitch: 2.5, roll: 0.6 },
        east: { heading: 88.9, pitch: 2, roll: 0.7 },
        west: { heading: -86.6, pitch: 2.3, roll: 1.2 }
    };

    let correction;
    // Identifier l'orientation en fonction de l'attitude_head
    if (attitude.heading > -45 && attitude.heading < 45) {
        // North
        correction = corrections.north;
    } else if (attitude.heading > 135 || attitude.heading < -135) {
        // South
        correction = corrections.south;
    } else if (attitude.heading > 45 && attitude.heading < 135) {
        // East
        correction = corrections.east;
    } else {
        // West
        correction = corrections.west;
    }

    // Appliquer les corrections aux valeurs actuelles d'attitude
    return {
        heading: attitude.heading + correction.heading,
        pitch: attitude.pitch + correction.pitch,
        roll: attitude.roll + correction.roll
    };
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

onMounted(async () => {
    viewer = new Viewer('cesiumContainer', {
        shouldAnimate: true,  // Activer l'animation
        terrain: Terrain.fromWorldTerrain()
    });

    viewer.scene.primitives.add(await createOsmBuildingsAsync());



    // Ajustement de la vue pour inclure toutes les étapes
    adjustCameraView(props.flightRecords);

    // Trajectoire avec flèches blanches
    // createFlightPathWithArrows(props.flightRecords);
    // createDistinctFlightArrows(props.flightRecords);

    // Numérotation des étapes
    // addStepLabels(props.flightRecords);
    // addStepLabelsWithTriangle(props.flightRecords);

    // Calculer les positions avec les altitudes avant d'appeler les autres fonctions
    await calculatePositionsWithAltitude(props.flightRecords);

    // Trajectoire avec flèches blanches
    createDistinctFlightArrows();

    // Numérotation des étapes
    addStepLabelsWithTriangle();

    // Afficher le cône de vision uniquement pour l'étape actuelle
    if (props.flightRecords[props.currentStepIndex]) {
        //currentConeEntity = await createVisionCone(props.currentStepIndex);
        currentConeObjet = (await createVisionCone(props.flightRecords[props.currentStepIndex]));
        currentConeEntity = currentConeObjet.coneEntity;
        currentDroneEntity = currentConeObjet.droneEntity;
        //lookAtCurrentStep(props.flightRecords[props.currentStepIndex]); // Suivre la position courante
    }

});

// Surveiller les changements de l'étape actuelle pour mettre à jour le cône de vision et le lookAt
watch(() => props.currentStepIndex, async (newIndex) => {
    // Supprimer toutes les entités avant d'ajouter le cône de l'étape actuelle
    //viewer.entities.removeAll();

    // Réafficher la trajectoire, les flèches et les labels
    // createFlightPathWithArrows(props.flightRecords);
    //createDistinctFlightArrows(props.flightRecords);
    // addStepLabels(props.flightRecords);
    //addStepLabelsWithTriangle(props.flightRecords);

    // // Afficher le cône de vision uniquement pour l'étape en cours
    // if (props.flightRecords[newIndex]) {
    //     createVisionCone(props.flightRecords[newIndex]);
    //     //createVisionFrustum(props.flightRecords[newIndex], 200);
    //     //lookAtCurrentStep(props.flightRecords[newIndex]); // Suivre la position courante
    // }

    // Si un cône de vision existe déjà, le supprimer
    if (currentConeEntity) {
        viewer.entities.remove(currentConeEntity);
        viewer.entities.remove(currentDroneEntity);
        currentConeObjet = null; // Réinitialiser la variable
    }

    // Afficher le cône de vision uniquement pour l'étape en cours
    if (props.flightRecords[newIndex]) {
        currentConeObjet = (await createVisionCone(props.flightRecords[props.currentStepIndex]));
        currentConeEntity = currentConeObjet.coneEntity;
        currentDroneEntity = currentConeObjet.droneEntity;
        viewer.trackedEntity = currentConeEntity;
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
