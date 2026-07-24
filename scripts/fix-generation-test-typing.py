from pathlib import Path

path = Path('scripts/apply-generation-quality-speed.py')
source = path.read_text(encoding='utf8')

fetch_before = "const fetchMock = vi.fn(async () => sseResponse([openaiChunk(````html\\n${html}\\n````), '[DONE]']))"
fetch_after = "const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse([openaiChunk(````html\\n${html}\\n````), '[DONE]']))"
if fetch_before not in source:
    raise SystemExit('test fetch mock anchor not found')
source = source.replace(fetch_before, fetch_after, 1)

completeness_before = "`- 按${generation.label}控制复杂度；完整闭合优先于装饰数量`,"
completeness_after = "`- 完整性高于一切：按${generation.label}控制复杂度，完整闭合优先于装饰数量`,"
if completeness_before not in source:
    raise SystemExit('iteration completeness anchor not found')
source = source.replace(completeness_before, completeness_after, 1)

path.write_text(source, encoding='utf8')
