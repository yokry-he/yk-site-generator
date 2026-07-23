<script setup lang="ts">
import { onMounted, watch } from 'vue'
import NavBar from './components/NavBar.vue'
import SiteFooter from './components/SiteFooter.vue'
import ModelSettingsDialog from './components/ModelSettingsDialog.vue'
import AuthDialog from './components/AuthDialog.vue'
import CommandPalette from './components/CommandPalette.vue'
import HistoryMigrationNotice from './components/HistoryMigrationNotice.vue'
import OnboardingGuide from './components/OnboardingGuide.vue'
import ProjectFeedbackPrompt from './components/ProjectFeedbackPrompt.vue'
import ToastHost from './components/ToastHost.vue'
import { useAuth } from './composables/useAuth'
import { useFeatures } from './composables/useFeatures'

const { user, loadAuthSession } = useAuth()
const { enabled, loadFeatures } = useFeatures()

onMounted(async () => {
  await loadAuthSession()
  await loadFeatures()
})
watch(() => user.value?.id, () => void loadFeatures())
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
    <CommandPalette />
    <HistoryMigrationNotice />
    <OnboardingGuide v-if="enabled('onboarding-guide')" />
    <ProjectFeedbackPrompt v-if="enabled('quality-feedback')" />
    <ToastHost />
  </div>
</template>
