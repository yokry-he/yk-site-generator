# Visual baseline diagnostic

patch=0
install=0
browser=0
behavior=1
visual=99

## Log tail
```text
    +         "html": "<span class=\"rounded-full bg-brand1/10 px-3 py-1 text-[10px] font-semibold text-brand1\">商业营销</span>",
    +         "impact": "serious",
    +         "none": Array [],
    +         "target": Array [
    +           ".bg-brand1\\/10.py-1.px-3",
    +         ],
    +       },
    +       Object {
    +         "all": Array [],
    +         "any": Array [
    +           Object {
    +             "data": Object {
    +               "bgColor": "#120f1b",
    +               "contrastRatio": 4.46,
    +               "expectedContrastRatio": "4.5:1",
    +               "fgColor": "#8b5cf6",
    +               "fontSize": "10.5pt (14px)",
    +               "fontWeight": "normal",
    +               "messageKey": null,
    +             },
    +             "id": "color-contrast",
    +             "impact": "serious",
    +             "message": "Element has insufficient color contrast of 4.46 (foreground color: #8b5cf6, background color: #120f1b, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
    +             "relatedNodes": Array [
    +               Object {
    +                 "html": "<button class=\"flex items-center gap-2 rounded-xl border border-brand1/20 bg-brand1/[0.07] px-4 py-3 text-sm font-semibold text-brand1\">",
    +                 "target": Array [
    +                   ".border-brand1\\/20",
    +                 ],
    +               },
    +               Object {
    +                 "html": "<div class=\"min-h-screen bg-app text-ink\">",
    +                 "target": Array [
    +                   ".bg-app",
    +                 ],
    +               },
    +             ],
    +           },
    +         ],
    +         "failureSummary": "Fix any of the following:
    +   Element has insufficient color contrast of 4.46 (foreground color: #8b5cf6, background color: #120f1b, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
    +         "html": "<button class=\"flex items-center gap-2 rounded-xl border border-brand1/20 bg-brand1/[0.07] px-4 py-3 text-sm font-semibold text-brand1\">",
    +         "impact": "serious",
    +         "none": Array [],
    +         "target": Array [
    +           ".border-brand1\\/20",
    +         ],
    +       },
    +       Object {
    +         "all": Array [],
    +         "any": Array [
    +           Object {
    +             "data": Object {
    +               "bgColor": "#1a1624",
    +               "contrastRatio": 4.18,
    +               "expectedContrastRatio": "4.5:1",
    +               "fgColor": "#8b5cf6",
    +               "fontSize": "7.5pt (10px)",
    +               "fontWeight": "normal",
    +               "messageKey": null,
    +             },
    +             "id": "color-contrast",
    +             "impact": "serious",
    +             "message": "Element has insufficient color contrast of 4.18 (foreground color: #8b5cf6, background color: #1a1624, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
    +             "relatedNodes": Array [
    +               Object {
    +                 "html": "<button class=\"rounded-xl border px-2 py-2.5 text-[10px] border-brand1/30 bg-brand1/[0.07] font-semibold text-brand1\">",
    +                 "target": Array [
    +                   ".border-brand1\\/30",
    +                 ],
    +               },
    +               Object {
    +                 "html": "<section class=\"rounded-3xl border border-line/10 bg-soft/55 p-5\">",
    +                 "target": Array [
    +                   ".p-5.rounded-3xl:nth-child(1)",
    +                 ],
    +               },
    +               Object {
    +                 "html": "<div class=\"min-h-screen bg-app text-ink\">",
    +                 "target": Array [
    +                   ".bg-app",
    +                 ],
    +               },
    +             ],
    +           },
    +         ],
    +         "failureSummary": "Fix any of the following:
    +   Element has insufficient color contrast of 4.18 (foreground color: #8b5cf6, background color: #1a1624, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
    +         "html": "<button class=\"rounded-xl border px-2 py-2.5 text-[10px] border-brand1/30 bg-brand1/[0.07] font-semibold text-brand1\">",
    +         "impact": "serious",
    +         "none": Array [],
    +         "target": Array [
    +           ".border-brand1\\/30",
    +         ],
    +       },
    +     ],
    +     "tags": Array [
    +       "cat.color",
    +       "wcag2aa",
    +       "wcag143",
    +       "TTv5",
    +       "TT13.c",
    +       "EN-301-549",
    +       "EN-9.1.4.3",
    +       "ACT",
    +       "RGAAv4",
    +       "RGAA-3.2.1",
    +     ],
    +   },
    + ]

       6 |   const result = await new AxeBuilder({ page }).exclude('iframe').analyze()
       7 |   const serious = result.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical')
    >  8 |   expect(serious, serious.map((item) => `${item.id}: ${item.description}`).join('\n')).toEqual([])
         |                                                                                        ^
       9 | }
      10 |
      11 | test('public pages have no serious accessibility violations', async ({ page }) => {
        at expectNoSeriousViolations (/home/runner/work/yk-site-generator/yk-site-generator/apps/web/tests/e2e/accessibility.spec.ts:8:88)
        at /home/runner/work/yk-site-generator/yk-site-generator/apps/web/tests/e2e/accessibility.spec.ts:16:5

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/accessibility-public-pages-c5f80-us-accessibility-violations-chromium-mobile-retry1/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/accessibility-public-pages-c5f80-us-accessibility-violations-chromium-mobile-retry1/video-1.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #3: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/accessibility-public-pages-c5f80-us-accessibility-violations-chromium-mobile-retry1/video-2.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #4: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/accessibility-public-pages-c5f80-us-accessibility-violations-chromium-mobile-retry1/video-3.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #5: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/accessibility-public-pages-c5f80-us-accessibility-violations-chromium-mobile-retry1/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/accessibility-public-pages-c5f80-us-accessibility-violations-chromium-mobile-retry1/error-context.md

    attachment #7: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/accessibility-public-pages-c5f80-us-accessibility-violations-chromium-mobile-retry1/trace.zip
    Usage:

        pnpm exec playwright show-trace test-results/accessibility-public-pages-c5f80-us-accessibility-violations-chromium-mobile-retry1/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────


  2 failed
    [chromium-desktop] › tests/e2e/accessibility.spec.ts:11:1 › public pages have no serious accessibility violations 
    [chromium-mobile] › tests/e2e/accessibility.spec.ts:11:1 › public pages have no serious accessibility violations 
  4 skipped
  12 passed (1.0m)
/home/runner/work/yk-site-generator/yk-site-generator/apps/web:
[ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] web@0.0.0 e2e:browser: `playwright test --grep-invert @visual`
Exit status 1
```
