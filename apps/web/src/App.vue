<script setup lang="ts">
import { onMounted } from 'vue'
import NavBar from './components/NavBar.vue'
import SiteFooter from './components/SiteFooter.vue'
import ModelSettingsDialog from './components/ModelSettingsDialog.vue'
import AuthDialog from './components/AuthDialog.vue'
import HistoryMigrationNotice from './components/HistoryMigrationNotice.vue'
import ToastHost from './components/ToastHost.vue'
import { useAuth } from './composables/useAuth'

const { loadAuthSession } = useAuth()
onMounted(loadAuthSession)
</script>

<template>
  <div class="min-h-screen bg-app text-ink">
    <NavBar />
    <RouterView v-slot="{ Component }">
      <component :is="Component" />
    </RouterView>
    <SiteFooter />
    <ModelSettingsDialog />
    <AuthDialog />
    <HistoryMigrationNotice />
    <ToastHost />
  </div>
</template>
