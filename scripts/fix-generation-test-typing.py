from pathlib import Path

path = Path('scripts/apply-generation-quality-speed.py')
source = path.read_text(encoding='utf8')
before = "const fetchMock = vi.fn(async () => sseResponse([openaiChunk(````html\\n${html}\\n````), '[DONE]']))"
after = "const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse([openaiChunk(````html\\n${html}\\n````), '[DONE]']))"
if before not in source:
    raise SystemExit('test fetch mock anchor not found')
path.write_text(source.replace(before, after, 1), encoding='utf8')
