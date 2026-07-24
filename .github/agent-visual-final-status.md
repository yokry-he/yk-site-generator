# Final visual diagnostic

patch=0
install=0
browser=0
behavior=1
visual=99

## Log tail
```text
    +             },
    +             "id": "non-empty-title",
    +             "impact": "critical",
    +             "message": "Element has no title attribute",
    +             "relatedNodes": Array [],
    +           },
    +           Object {
    +             "data": null,
    +             "id": "implicit-label",
    +             "impact": "critical",
    +             "message": "Element does not have an implicit (wrapped) <label>",
    +             "relatedNodes": Array [],
    +           },
    +           Object {
    +             "data": null,
    +             "id": "explicit-label",
    +             "impact": "critical",
    +             "message": "Element does not have an explicit <label>",
    +             "relatedNodes": Array [],
    +           },
    +           Object {
    +             "data": null,
    +             "id": "presentational-role",
    +             "impact": "critical",
    +             "message": "Element's default semantics were not overridden with role=\"none\" or role=\"presentation\"",
    +             "relatedNodes": Array [],
    +           },
    +         ],
    +         "failureSummary": "Fix any of the following:
    +   Element does not have inner text that is visible to screen readers
    +   aria-label attribute does not exist or is empty
    +   aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty
    +   Element has no title attribute
    +   Element does not have an implicit (wrapped) <label>
    +   Element does not have an explicit <label>
    +   Element's default semantics were not overridden with role=\"none\" or role=\"presentation\"",
    +         "html": "<button class=\"rounded-md p-1.5 text-faint\">",
    +         "impact": "critical",
    +         "none": Array [],
    +         "target": Array [
    +           ".p-1\\.5.rounded-md:nth-child(2)",
    +         ],
    +       },
    +       Object {
    +         "all": Array [],
    +         "any": Array [
    +           Object {
    +             "data": null,
    +             "id": "button-has-visible-text",
    +             "impact": "critical",
    +             "message": "Element does not have inner text that is visible to screen readers",
    +             "relatedNodes": Array [],
    +           },
    +           Object {
    +             "data": null,
    +             "id": "aria-label",
    +             "impact": "critical",
    +             "message": "aria-label attribute does not exist or is empty",
    +             "relatedNodes": Array [],
    +           },
    +           Object {
    +             "data": null,
    +             "id": "aria-labelledby",
    +             "impact": "critical",
    +             "message": "aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty",
    +             "relatedNodes": Array [],
    +           },
    +           Object {
    +             "data": Object {
    +               "messageKey": "noAttr",
    +             },
    +             "id": "non-empty-title",
    +             "impact": "critical",
    +             "message": "Element has no title attribute",
    +             "relatedNodes": Array [],
    +           },
    +           Object {
    +             "data": null,
    +             "id": "implicit-label",
    +             "impact": "critical",
    +             "message": "Element does not have an implicit (wrapped) <label>",
    +             "relatedNodes": Array [],
    +           },
    +           Object {
    +             "data": null,
    +             "id": "explicit-label",
    +             "impact": "critical",
    +             "message": "Element does not have an explicit <label>",
    +             "relatedNodes": Array [],
    +           },
    +           Object {
    +             "data": null,
    +             "id": "presentational-role",
    +             "impact": "critical",
    +             "message": "Element's default semantics were not overridden with role=\"none\" or role=\"presentation\"",
    +             "relatedNodes": Array [],
    +           },
    +         ],
    +         "failureSummary": "Fix any of the following:
    +   Element does not have inner text that is visible to screen readers
    +   aria-label attribute does not exist or is empty
    +   aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty
    +   Element has no title attribute
    +   Element does not have an implicit (wrapped) <label>
    +   Element does not have an explicit <label>
    +   Element's default semantics were not overridden with role=\"none\" or role=\"presentation\"",
    +         "html": "<button class=\"rounded-md p-1.5 text-faint\">",
    +         "impact": "critical",
    +         "none": Array [],
    +         "target": Array [
    +           ".p-1\\.5.rounded-md:nth-child(3)",
    +         ],
    +       },
    +     ],
    +     "tags": Array [
    +       "cat.name-role-value",
    +       "wcag2a",
    +       "wcag412",
    +       "section508",
    +       "section508.22.a",
    +       "TTv5",
    +       "TT6.a",
    +       "EN-301-549",
    +       "EN-9.4.1.2",
    +       "ACT",
    +       "RGAAv4",
    +       "RGAA-11.9.1",
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
    test-results/accessibility-public-pages-c5f80-us-accessibility-violations-chromium-mobile-retry1/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #4: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/accessibility-public-pages-c5f80-us-accessibility-violations-chromium-mobile-retry1/video-2.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #5: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/accessibility-public-pages-c5f80-us-accessibility-violations-chromium-mobile-retry1/video-3.webm
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
  12 passed (1.2m)
/home/runner/work/yk-site-generator/yk-site-generator/apps/web:
[ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] web@0.0.0 e2e:browser: `playwright test --grep-invert @visual`
Exit status 1
```
