from pathlib import Path

path = Path('apps/web/src/components/GeneratorDemo.vue')
source = path.read_text(encoding='utf8')

anchor = "const stream = useGenerateStream()\n\nconst tab = ref<'ai' | 'template'>('ai')"
replacement = "const stream = useGenerateStream()\n// Session must exist before eager computed/watch sources evaluate during setup.\nconst session = ref<IterationSession>(createSession())\n\nconst tab = ref<'ai' | 'template'>('ai')"
if anchor not in source:
    raise SystemExit('stream initialization anchor not found')
source = source.replace(anchor, replacement, 1)

late = "const session = ref<IterationSession>(createSession())\nconst instructionInput = ref('')"
if late not in source:
    raise SystemExit('late session declaration anchor not found')
source = source.replace(late, "const instructionInput = ref('')", 1)

path.write_text(source, encoding='utf8')
