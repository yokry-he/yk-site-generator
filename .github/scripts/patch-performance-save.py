from pathlib import Path

performance_path = Path('apps/web/scripts/performance-baseline.ts')
performance_source = performance_path.read_text(encoding='utf-8')
old = """        const saveStartedAt = nodePerformance.now()
        await editor.getByRole('button', { name: /保存为新版本/ }).click()
        await editor.getByText(/已保存/).waitFor({ state: 'visible' })
        samples.push({ scenario: 'version-save', device: 'desktop', run, durationMs: round(nodePerformance.now() - saveStartedAt) })
"""
new = """        await editor.getByRole('button', { name: '添加' }).click()
        await editor.getByRole('button', { name: /行动号召/ }).click()
        const saveButton = editor.getByRole('button', { name: /保存为新版本/ })
        await saveButton.waitFor({ state: 'visible' })
        const saveStartedAt = nodePerformance.now()
        await saveButton.click()
        await editor.getByText(/已保存/).waitFor({ state: 'visible' })
        samples.push({ scenario: 'version-save', device: 'desktop', run, durationMs: round(nodePerformance.now() - saveStartedAt) })
"""
if old not in performance_source:
    raise SystemExit('performance save target not found')
performance_path.write_text(performance_source.replace(old, new, 1), encoding='utf-8')

ci_path = Path('.github/workflows/ci.yml')
ci_source = ci_path.read_text(encoding='utf-8')
start_marker = '  # BEGIN TEMP PERFORMANCE PATCH\n'
end_marker = '  # END TEMP PERFORMANCE PATCH\n\n'
start = ci_source.find(start_marker)
end = ci_source.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('temporary CI patch block not found')
end += len(end_marker)
ci_path.write_text(ci_source[:start] + ci_source[end:], encoding='utf-8')

for temporary_path in (
    Path('.github/workflows/agent-fix-performance-save.yml'),
    Path('.github/scripts/patch-performance-save.py'),
):
    temporary_path.unlink(missing_ok=True)
