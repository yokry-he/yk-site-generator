import { createRouter,createWebHistory } from 'vue-router'
import HomePage from '../pages/HomePage.vue'
export const router=createRouter({history:createWebHistory(),routes:[
 {path:'/',name:'home',component:HomePage,meta:{title:'SiteForge · AI 网站生成器'}},
 {path:'/generator',name:'generator',component:()=>import('../pages/GeneratorPage.vue'),meta:{title:'生成网站 · SiteForge'}},
 {path:'/starters',name:'starter-projects',component:()=>import('../pages/StarterProjectsPage.vue'),meta:{title:'内置项目 · SiteForge'}},
 {path:'/starters/:slug',name:'starter-project',component:()=>import('../pages/StarterProjectPage.vue'),meta:{title:'内置项目工作台 · SiteForge'}},
 {path:'/templates',name:'templates',component:()=>import('../pages/TemplatesPage.vue'),meta:{title:'官方模板 · SiteForge'}},
 {path:'/templates/:slug',name:'template-detail',component:()=>import('../pages/TemplateDetailPage.vue'),meta:{title:'模板详情 · SiteForge'}},
 {path:'/projects',name:'projects',component:()=>import('../pages/ProjectsPage.vue'),meta:{title:'项目工作区 · SiteForge'}},
 {path:'/projects/new',name:'manual-project',component:()=>import('../pages/ManualProjectPage.vue'),meta:{title:'手动创建全栈工程 · SiteForge'}},
 {path:'/projects/:id',name:'project-detail',component:()=>import('../pages/ProjectPage.vue'),meta:{title:'项目详情 · SiteForge'}},
 {path:'/projects/:id/engineering',name:'project-engineering',component:()=>import('../pages/EngineeringWorkspacePage.vue'),meta:{title:'工程工作区 · SiteForge'}},
 {path:'/projects/:id/delivery',name:'project-delivery',component:()=>import('../pages/EngineeringDeliveryPage.vue'),meta:{title:'工程交付 · SiteForge'}},
 {path:'/brand',name:'brand-kits',component:()=>import('../pages/BrandKitsPage.vue'),meta:{title:'品牌套件 · SiteForge'}},
 {path:'/brand/assets',name:'brand-assets',component:()=>import('../pages/BrandAssetsPage.vue'),meta:{title:'品牌资源库 · SiteForge'}},
 {path:'/usage',name:'usage',component:()=>import('../pages/QuotaPage.vue'),meta:{title:'额度与用量 · SiteForge'}},
 {path:'/admin',name:'admin',component:()=>import('../pages/AdminPage.vue'),meta:{title:'运营总览 · SiteForge'}},
 {path:'/admin/templates',name:'admin-templates',component:()=>import('../pages/AdminTemplatesPage.vue'),meta:{title:'模板运营 · SiteForge'}},
 {path:'/admin/feature-flags',name:'admin-feature-flags',component:()=>import('../pages/AdminFeatureFlagsPage.vue'),meta:{title:'功能开关 · SiteForge'}},
 {path:'/admin/quality',name:'admin-quality',component:()=>import('../pages/AdminQualityPage.vue'),meta:{title:'质量反馈 · SiteForge'}},
 {path:'/pricing',name:'pricing',component:()=>import('../pages/PricingPage.vue'),meta:{title:'定价 · SiteForge'}},
 {path:'/docs',name:'docs',component:()=>import('../pages/DocsPage.vue'),meta:{title:'文档 · SiteForge'}},
 {path:'/changelog',name:'changelog',component:()=>import('../pages/ChangelogPage.vue'),meta:{title:'更新日志 · SiteForge'}},
 {path:'/about',name:'about',component:()=>import('../pages/AboutPage.vue'),meta:{title:'关于 · SiteForge'}},
 {path:'/:pathMatch(.*)*',name:'not-found',component:()=>import('../pages/NotFoundPage.vue'),meta:{title:'页面不存在 · SiteForge'}},
],scrollBehavior(to,_from,savedPosition){if(to.hash)return new Promise((resolve)=>window.setTimeout(()=>resolve({el:to.hash,behavior:'smooth',top:80}),120));if(savedPosition)return savedPosition;return{top:0}}})
router.afterEach((to,from)=>{document.title=typeof to.meta.title==='string'?to.meta.title:'SiteForge';if(from.matched.length)window.requestAnimationFrame(()=>document.getElementById('main-content')?.focus({preventScroll:true}))})
