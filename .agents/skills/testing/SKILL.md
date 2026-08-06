---
name: testing
description: How to write and choose tests in this repo. Use when adding, changing, or reviewing Vitest, Playwright, halo-web, service, or end-to-end tests.
---

# Testing

## Principles

1. Do not use mocks such as `vi.fn`, `vi.mock`, or hand-rolled fake collaborators.
2. When testing an abstraction (the full app or a meaty service), act and observe it the way a user of that abstraction would:
   - Electron / web UI: drive the running app with Playwright through `pnpm halo-web` and assert visible elements, roles, labels, and text.
   - Services and other APIs: call the public methods, then read results through the same public API (or another real collaborator the user of that abstraction would use).
3. If that kind of test is hard to build and none already exist for the area, do not add a new test.
4. Do not assert implementation details such as internal file layouts or exact formatting of private outputs.
5. Prefer Vitest fixtures for shared setup and teardown instead of ad-hoc helpers or manual cleanup. See the [Vitest fixtures documentation](https://vitest.dev/guide/test-context.html#test-extend).

## Halo UI

Use the `halo-web` skill. Start the app separately when needed, then act and assert through the live renderer.
