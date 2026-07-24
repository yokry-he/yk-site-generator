from pathlib import Path


def replace(path: str, before: str, after: str) -> None:
    file = Path(path)
    source = file.read_text(encoding='utf8')
    if before not in source:
        raise SystemExit(f'anchor not found in {path}')
    file.write_text(source.replace(before, after, 1), encoding='utf8')


replace(
    'apps/web/src/style.css',
    '''@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}''',
    '''@keyframes fade-up {
  from {
    transform: translateY(14px);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes fade-in {
  from {
    transform: translateY(4px);
  }
  to {
    transform: translateY(0);
  }
}''',
)

replace(
    'apps/web/src/components/GeneratorDemo.vue',
    '''<span class="block text-xs font-semibold" :class="generationMode === item.id ? 'text-brand1' : 'text-ink'">{{ item.label }}</span>''',
    '''<span class="block text-xs font-semibold text-ink">{{ item.label }}</span>''',
)
