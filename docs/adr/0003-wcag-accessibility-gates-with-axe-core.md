# 0003. WCAG accessibility gates with `@axe-core/playwright`

## Status

Accepted (amends [0001](0001-vanilla-static-stack-and-shared-playwright-harness.md) and [0002](0002-public-repo-governance-and-readonly-verification.md))

## Date

2026-11-25

## Context

The 8-gate Playwright verification suite checked HTML5 landmarks, navigation, footer, overflow, offline isolation, and strict-copy rules, but did not catch WCAG 2.1 AA accessibility or color-contrast failures (such as light text on terracotta/tan buttons or sage-green headings on cream backgrounds).

## Decision

- Pin `@axe-core/playwright` (`4.14.1`) once in root `package.json` and `package-lock.json` (never inside individual `sites/<slug>/` directories).
- Add **Gate #9** to [tests/site.spec.mjs](../../tests/site.spec.mjs) running `AxeBuilder` with `wcag2a`, `wcag2aa`, `wcag21a`, and `wcag21aa` tags on every site check, failing with structured impact, rule ID, node selector, and remediation summary when any violation is found.
- Remediate color-contrast violations and UTF-8 `ß` typos across the showcase sites (`buchhandlung-morgenrot`, `kaffeekultur-berlin`, `kiezgarten-kaffee`, `konditorei-flora-berlin`) and refresh their `evidence/{desktop,mobile}.png` screenshots.

## Consequences

- Both local `task ci` and `ai-factory`'s `RunTesterAgentActivity` automatically enforce WCAG 2.1 AA accessibility and 4.5:1 text contrast on every generated or modified site.
