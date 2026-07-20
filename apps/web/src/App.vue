<script setup lang="ts">
import NavBar from './components/NavBar.vue'
import SiteFooter from './components/SiteFooter.vue'
import ModelSettingsDialog from './components/ModelSettingsDialog.vue'
import ToastHost from './components/ToastHost.vue'
</script>

<template>
  <div class="min-h-screen bg-app text-ink">
    <NavBar />
    <RouterView v-slot="{ Component }">
      <component :is="Component" />
    </RouterView>
    <SiteFooter />
    <ModelSettingsDialog />
    <ToastHost />
  </div>
</template>
