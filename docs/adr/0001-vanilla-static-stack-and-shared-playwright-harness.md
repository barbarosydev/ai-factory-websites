# 0001. Vanilla static stack and shared Playwright harness

## Status

Accepted

## Date

2026-11-21

## Context

`ai-factory-websites` stores responsive single-page static websites built and modified by local LLM agents (`gemma4:12b` and `gemma4:e4b`). Introducing per-site build systems (React, Next.js, Astro, Tailwind) adds compiler failure modes, slows verification, and requires per-site `node_modules`.

## Decision

- All sites live in one monorepo under `sites/<site-slug>/` and use plain semantic HTML5 (`index.html`), modern CSS (`styles.css`), and optional vanilla ES6 JavaScript (`script.js`).
- A single root `package.json` pins `@playwright/test` (`1.65.1`). Individual sites never have `package.json` or `node_modules`.
- Each site stores its `spec.json` (`WebsiteSpecification`) alongside its code, and a single parameterized Playwright spec (`tests/site.spec.mjs`) validates every site deterministically across desktop (`1280x800`) and mobile (`375x812`) viewports while blocking all outbound network requests.
- Screenshots (`evidence/desktop.png`, `evidence/mobile.png`) are committed on PR branches so GitHub renders visual proof inline.

## Consequences

- Zero per-site build step or dependency rot.
- Local LLM agents spend repair attempts on layout and copy rather than bundler configuration.
- Verification takes ~2–3 seconds per site and runs identically locally and in GitHub Actions.
