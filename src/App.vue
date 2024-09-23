<template>
  <div class="flex h-screen">
    <LeftSidebar class="w-1/4 bg-gray-100 p-4" />
    <div class="flex-1">
      <!-- <CesiumViewer /> -->
      <DronePlayer />
    </div>
  </div>
</template>

<script>
import LeftSidebar from './components/LeftSidebar.vue'
import CesiumViewer from './components/CesiumViewer.vue'
import DronePlayer from './components/DronePlayer.vue';
// import { useDroneStore } from '@/stores/droneStore.js';

export default {
  components: {
    LeftSidebar,
    // CesiumViewer
    DronePlayer
  }
}
</script>

<style scoped></style>
