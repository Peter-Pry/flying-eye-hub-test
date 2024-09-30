<template>
    <div v-if="selectedDrone && flightRecordsLoaded" class="viewer">
        <h2>Détails du Drone : {{ selectedDrone.dev_name }}</h2>

        <!-- Affichage de l'étape actuelle sur la carte Cesium -->
        <CesiumViewer :droneStep="currentStep" :flightRecords="flightRecordsArray"
            :currentStepIndex="currentStepIndex" />

        <!-- Contrôles du lecteur de vol -->
        <div class="controls">
            <button @click="previousStep" class="btn">Étape précédente</button>
            <button @click="togglePlayPause" class="btn">{{ isPlaying ? 'Pause' : 'Play' }}</button>
            <button @click="nextStep" class="btn">Étape suivante</button>
        </div>

        <!-- Liste des étapes avec horodatage -->
        <h2>Liste des étapes</h2>
        <ul class="steps-list">
            <li v-for="(step, index) in flightRecordsArray" :key="index">
                <button @click="goToStep(index)">
                    {{ formatTimestamp(step.timestamp) }}
                </button>
            </li>
        </ul>
    </div>

    <div v-else>
        <!-- Affichage pendant le chargement -->
        <p v-if="isLoading">Chargement des données de vol...</p>
        <p v-else>Sélectionnez un drone pour voir les détails de son vol.</p>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useDroneStore } from '@/stores/droneStore';
import CesiumViewer from './CesiumViewer.vue';

const droneStore = useDroneStore();
const selectedDrone = computed(() => droneStore.selectedDrone);
const flightRecords = computed(() => droneStore.flightRecords);
const flightRecordsLoaded = computed(() => droneStore.flightRecordsLoaded); // Nouveau computed pour suivre le chargement des données
const isLoading = computed(() => droneStore.isLoading);

const currentStepIndex = ref(0);
const isPlaying = ref(false);
let interval = null;

// Conversion des flight_records en tableau
const flightRecordsArray = computed(() => {
    return Object.keys(flightRecords.value).map((timestamp) => ({
        timestamp,
        ...flightRecords.value[timestamp]
    }));
});

// Calcul de l'étape actuelle
const currentStep = computed(() => {
    return flightRecordsArray.value[currentStepIndex.value] || {};
});

// Passer à l'étape suivante
function nextStep() {
    if (currentStepIndex.value < flightRecordsArray.value.length - 1) {
        currentStepIndex.value += 1;
    }
}

// Revenir à l'étape précédente
function previousStep() {
    if (currentStepIndex.value > 0) {
        currentStepIndex.value -= 1;
    }
}

// Aller à une étape spécifique
function goToStep(index) {
    currentStepIndex.value = index;
}

// Lecture/Pause
function togglePlayPause() {
    if (isPlaying.value) {
        clearInterval(interval);
    } else {
        interval = setInterval(() => {
            if (currentStepIndex.value < flightRecordsArray.value.length - 1) {
                nextStep();
            } else {
                clearInterval(interval);
                isPlaying.value = false;
            }
        }, 1000);
    }
    isPlaying.value = !isPlaying.value;
}

// Format de l'horodatage
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
}
</script>

<style scoped>
.viewer {
    padding: 20px;
    border: 1px solid #ccc;
    border-radius: 5px;
}

.controls {
    margin-bottom: 20px;

}

.steps-list {
    list-style: none;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
}

.steps-list li {
    margin-right: 10px;
    margin-bottom: 10px;
}

.steps-list button,
.controls button {
    background: #007bff;
    color: white;
    border: none;
    padding: 5px 10px;
    cursor: pointer;
    margin-right: 5px;
    border-radius: 4px;
}
</style>
