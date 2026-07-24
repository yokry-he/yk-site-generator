from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    source = target.read_text(encoding='utf-8')
    if old not in source:
        raise SystemExit(f'target not found in {path}: {old[:80]!r}')
    target.write_text(source.replace(old, new, 1), encoding='utf-8')


replace_once(
    'apps/web/src/pages/TemplatesPage.vue',
    """const templates = ref<OfficialTemplateDefinition[]>([])
const filters = ref<OfficialTemplateFilters>({ categories: [], industries: [], styles: [] })
""",
    """const templates = ref<OfficialTemplateDefinition[]>(SITEFORGE_TEMPLATES)
const filters = ref<OfficialTemplateFilters>({
  categories: [...new Set(SITEFORGE_TEMPLATES.map((item) => item.category))],
  industries: [...new Set(SITEFORGE_TEMPLATES.map((item) => item.industry))],
  styles: [...new Set(SITEFORGE_TEMPLATES.flatMap((item) => item.styleTags))],
})
""",
)
replace_once(
    'apps/web/src/pages/TemplatesPage.vue',
    'const loading = ref(true)',
    'const loading = ref(false)',
)
replace_once(
    'apps/web/src/pages/TemplatesPage.vue',
    'await Promise.all([loadCatalog(), loadAccountData()])',
    'await Promise.all([loadCatalog(true), loadAccountData()])',
)

replace_once(
    'apps/web/src/pages/TemplateDetailPage.vue',
    'const loading = ref(true)',
    'const loading = ref(false)',
)
replace_once(
    'apps/web/src/pages/TemplateDetailPage.vue',
    """async function load() {
  loading.value = true
""",
    """async function load() {
""",
)

replace_once(
    'apps/web/src/pages/ProjectPage.vue',
    """        <div v-if="detail" class="min-w-0 flex-1"><div class="flex items-center gap-2"><h1 class="truncate text-base font-semibold">{{ detail.project.title }}</h1><span v-if="detail.project.templateId" class="rounded bg-violet-500/10 px-2 py-0.5 text-[9px] text-violet-500">官方模板</span></div><p class="truncate text-xs text-faint">{{ detail.project.requirement || '暂无需求描述' }}</p></div>
""",
    """        <div v-if="detail" class="min-w-0 flex-1"><div class="flex items-center gap-2"><h1 class="truncate text-base font-semibold">{{ detail.project.title }}</h1><span v-if="detail.project.templateId" class="rounded bg-violet-500/10 px-2 py-0.5 text-[9px] text-violet-500">官方模板</span></div><p class="truncate text-xs text-faint">{{ detail.project.requirement || '暂无需求描述' }}</p></div>
        <div v-else class="min-w-0 flex-1" aria-hidden="true"><div class="h-5 w-44 animate-pulse rounded bg-ink/[0.05]" /><div class="mt-1.5 h-3 w-72 max-w-full animate-pulse rounded bg-ink/[0.035]" /></div>
""",
)
replace_once(
    'apps/web/src/pages/ProjectPage.vue',
    """      <div v-if="loading && !detail" class="flex min-h-[65vh] items-center justify-center"><Loader2 class="h-7 w-7 animate-spin text-brand1" /></div>
""",
    """      <div v-if="loading && !detail" class="mt-5 grid min-h-[720px] gap-5 lg:grid-cols-[300px_minmax(0,1fr)]" aria-label="正在加载项目工作区">
        <aside class="hidden animate-pulse rounded-2xl border border-line/10 bg-soft/65 lg:block"><div class="h-12 border-b border-line/10" /><div class="space-y-3 p-3"><div v-for="item in 5" :key="item" class="h-20 rounded-xl bg-ink/[0.035]" /></div></aside>
        <section class="animate-pulse overflow-hidden rounded-2xl border border-line/10 bg-soft/60"><div class="h-14 border-b border-line/10 bg-app/45" /><div class="grid gap-4 p-7 sm:grid-cols-2 xl:grid-cols-4"><div v-for="item in 4" :key="item" class="h-32 rounded-2xl bg-ink/[0.035]" /></div><div class="mx-7 h-64 rounded-2xl bg-ink/[0.025]" /></section>
      </div>
""",
)

Path('.github/scripts/patch-cls.py').unlink(missing_ok=True)
