import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../pages/HomePage.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    // 除首页外全部路由级懒加载,按页面分包
    { path: '/generator', name: 'generator', component: () => import('../pages/GeneratorPage.vue') },
    { path: '/templates', name: 'templates', component: () => import('../pages/TemplatesPage.vue') },
    { path: '/projects', name: 'projects', component: () => import('../pages/ProjectsPage.vue') },
    { path: '/projects/:id', name: 'project-detail', component: () => import('../pages/ProjectPage.vue') },
    { path: '/brand', name: 'brand-kits', component: () => import('../pages/BrandKitsPage.vue') },
    { path: '/usage', name: 'usage', component: () => import('../pages/QuotaPage.vue') },
    { path: '/admin', name: 'admin', component: () => import('../pages/AdminPage.vue') },
    { path: '/admin/templates', name: 'admin-templates', component: () => import('../pages/AdminTemplatesPage.vue') },
    { path: '/admin/feature-flags', name: 'admin-feature-flags', component: () => import('../pages/AdminFeatureFlagsPage.vue') },
    { path: '/admin/quality', name: 'admin-quality', component: () => import('../pages/AdminQualityPage.vue') },
    { path: '/pricing', name: 'pricing', component: () => import('../pages/PricingPage.vue') },
    { path: '/docs', name: 'docs', component: () => import('../pages/DocsPage.vue') },
    { path: '/changelog', name: 'changelog', component: () => import('../pages/ChangelogPage.vue') },
    { path: '/about', name: 'about', component: () => import('../pages/AboutPage.vue') },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../pages/NotFoundPage.vue') },
  ],
  scrollBehavior(to, _from, savedPosition) {
    if (to.hash) {
      return new Promise((resolve) => {
        window.setTimeout(() => {
          resolve({ el: to.hash, behavior: 'smooth', top: 80 })
        }, 120)
      })
    }
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
})
