<script setup lang="ts">
import { onMounted, watch } from 'vue'
import NavBar from './components/NavBar.vue'
import SiteFooter from './components/SiteFooter.vue'
import ModelSettingsDialog from './components/ModelSettingsDialog.vue'
import AuthDialog from './components/AuthDialog.vue'
import CommandPalette from './components/CommandPalette.vue'
import ConfirmDialogHost from './components/ConfirmDialogHost.vue'
import NotificationCenter from './components/NotificationCenter.vue'
import ShortcutHelpDialog from './components/ShortcutHelpDialog.vue'
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
    <a href="#main-content" class="fixed top-2 left-2 z-[300] -translate-y-20 rounded-xl bg-brand1 px-4 py-2 text-sm font-semibold text-white transition-transform focus:translate-y-0">跳到主要内容</a>
    <NavBar />
    <div id="main-content" tabindex="-1">
      <RouterView v-slot="{ Component }"><component :is="Component" /></RouterView>
    </div>
    <SiteFooter />
    <ModelSettingsDialog />
    <AuthDialog />
    <CommandPalette />
    <NotificationCenter />
    <ShortcutHelpDialog />
    <ConfirmDialogHost />
    <HistoryMigrationNotice />
    <OnboardingGuide v-if="enabled('onboarding-guide')" />
    <ProjectFeedbackPrompt v-if="enabled('quality-feedback')" />
    <ToastHost />
  </div>
</template>
