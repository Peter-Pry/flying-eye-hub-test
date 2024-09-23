<template>
    <div class="w-1/4 bg-gray-100 p-4 h-full flex flex-col">
        <!-- Liste des drones -->
        <DroneList />
    </div>
</template>

<script>
import DroneList from '@/components/DroneList.vue'

export default {
    components: {
        DroneList
    },
}
</script>

<style scoped>
.bg-gray-100 {
    background-color: #f7fafc;
}
</style>
