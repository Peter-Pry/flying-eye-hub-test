import { defineStore } from 'pinia'
import axios from 'axios'

export const useDroneStore = defineStore('droneStore', {
  state: () => ({
    drones: [],
    selectedDrone: null,
    flightRecords: [],
    flightRecordsLoaded: false, // Indicateur pour savoir si les données sont chargées
    droneListLoaded: false,
    loading: false,
    error: null
  }),
  actions: {
    async fetchDrones() {
      this.loading = true
      this.error = null
      try {
        const response = await axios.get('/api/device?ConId=1')
        this.droneListLoaded = true
        //Simulation réponse API
        //const response = await axios.get('/drones.json')
        //console.log(response)

        this.drones = response.data
      } catch (error) {
        console.error('Erreur lors de la récupération des drones:', error)
        this.error = 'Erreur lors de la récupération des drones'
      } finally {
        this.loading = false
      }
    },
    selectDrone(drone) {
      this.selectedDrone = drone
      this.flightRecordsLoaded = false // Réinitialisation avant de charger les nouveaux flight_records
      this.fetchFlightRecords(drone)
    },
    async fetchFlightRecords(drone) {
      this.loading = true
      this.error = null
      try {
        // Pour l'instant, utilisation d'une URL statique, à terme ce sera dynamique selon le drone.
        const response = await axios.get('/drone-mission-example.json')
        this.flightRecords = response.data.flight_records
        this.flightRecordsLoaded = true // Indiquer que les flight records sont chargés
      } catch (error) {
        console.error('Erreur lors de la récupération des flight records:', error)
        this.error = 'Erreur lors de la récupération des flight records'
      } finally {
        this.loading = false
      }
    }
  }
})
