<template>
    <div class="container mx-auto p-4">
        <h1 class="text-2xl font-bold mb-4">Liste des drones</h1>

        <!-- Section de filtrage -->
        <div class="bg-gray-100 p-4 rounded-lg shadow mb-4">
            <!-- Input de recherche par nom -->
            <div class="mb-4">
                <input type="text" v-model="searchName" placeholder="Rechercher par nom"
                    class="border border-gray-300 p-2 w-full rounded" />
            </div>

            <!-- Checkboxes pour filtrer par site -->
            <div class="mb-4">
                <h2 class="font-semibold mb-2">Filtrer par site :</h2>
                <div class="flex flex-wrap">
                    <div v-for="site in uniqueSites" :key="site" class="mr-4 mb-2">
                        <label class="flex items-center">
                            <input type="checkbox" :value="site" v-model="selectedSites" class="mr-2" />
                            {{ site }}
                        </label>
                    </div>
                </div>
            </div>
        </div>

        <!-- Bouton pour rafraîchir la liste-->
        <div class="mt-6 pb-6">
            <button class="bg-green-500 text-white font-bold py-2 px-4 rounded hover:bg-green-600"
                @click="droneStore.fetchDrones()">
                Rafraîchir la liste
            </button>
        </div>

        <!-- Liste filtrée des drones -->
        <ul class="space-y-2">
            <li v-for="drone in filteredDrones" :key="drone.dev_id"
                class="border border-gray-300 p-4 rounded-lg shadow">
                <div class="flex justify-between items-center">
                    <div>
                        <p class="font-semibold">{{ drone.dev_name }}</p>
                        <p class="text-gray-500">{{ drone.sit_name }}</p>
                    </div>
                    <button @click="droneStore.selectDrone(drone)"
                        class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
                        >
                    </button>
                </div>
            </li>
        </ul>

        <!-- Bouton pour rafraîchir -->
        <div class="mt-6">
            <button class="bg-green-500 text-white font-bold py-2 px-4 rounded hover:bg-green-600"
                @click="droneStore.fetchDrones()">
                Rafraîchir
            </button>
        </div>
    </div>
</template>

<script setup>
import { useDroneStore } from '@/stores/droneStore.js'
import { ref, computed, onMounted } from 'vue'

// Charger le store des drones
const droneStore = useDroneStore();

// Champs de recherche
const searchName = ref('');
const selectedSites = ref([]);

// Extraire la liste des sites uniques
const uniqueSites = computed(() => {
    const sites = droneStore.drones.map(drone => drone.sit_name);
    return [...new Set(sites)]; // Supprime les doublons avec Set
});

// Propriété calculée pour filtrer les drones
const filteredDrones = computed(() => {
    let drones = droneStore.drones;

    // Filtrer par nom si un nom est recherché
    if (searchName.value) {
        drones = drones.filter(drone =>
            drone.dev_name.toLowerCase().includes(searchName.value.toLowerCase())
        );
    }

    // Filtrer par sites sélectionnés s'il y en a
    if (selectedSites.value.length > 0) {
        drones = drones.filter(drone => selectedSites.value.includes(drone.sit_name));
    }

    return drones;
});

// Charger les drones au montage du composant
onMounted(() => {
    droneStore.fetchDrones();
});
</script>

<style>
.container {
    max-width: 800px;
}
</style>
