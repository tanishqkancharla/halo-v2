---
name: testing
description: Choose, write, and review tests that exercise real consumer behavior, prioritize successful workflows, and give each test distinct coverage. Use when adding, changing, or reviewing Vitest tests, Playwright end-to-end tests, or their harnesses.
---

# Testing

Use Vitest for service, API, and library tests, and Playwright for UI end-to-end tests. These conventions apply across projects.

## Principles

1. Prioritize positive tests that prove successful user or consumer workflows. Exercise those workflows end to end at the boundary being tested. Rejection cases can supplement these workflows, but should not dominate the suite. Keep negative coverage grouped separately.
2. Do not use mocks such as `vi.fn`, `vi.mock`, or hand-rolled fake collaborators.
3. Act and observe the system the way a consumer would:
   - UI: drive the running application with Playwright and assert visible elements, roles, labels, text, and behavior.
   - Services and APIs: call public methods and observe results through the same public API or another real collaborator a consumer would use.
   - Libraries: use the public interface and verify the result or observable effect.
   - State the tested boundary accurately. An API test does not establish that a UI displays the result correctly.
4. Give each test one distinct behavior to verify. Split unrelated behaviors into independently reported cases with isolated state. Multiple steps or assertions are appropriate when they establish that one behavior.
5. Assertions should belong to the behavior named by the test. Do not repeat assertions another test already owns. Shared setup may repeat without reasserting that setup works. Before/after observations needed to prove a particular transition still belong together.
6. Assert only the relevant observable result, rather than checking an entire response when most fields are covered elsewhere. Avoid assertions about private implementation details, internal file layouts, or formatting that is not part of the public contract.
7. Prefer Vitest fixtures and Playwright fixtures for shared setup, isolated state, and cleanup instead of ad-hoc helpers or manual cleanup. Tests should run independently of execution order. See the [Vitest fixtures documentation](https://vitest.dev/guide/test-context.html#test-extend) and [Playwright fixtures documentation](https://playwright.dev/docs/test-fixtures).
8. Keep setup readable. Use small harness helpers for repetitive mechanics such as preparing files, inputs, and resources. Keep scenario actions and assertions visible in the test; helpers should not silently perform those actions or verify unrelated behavior. Use the real client API for operations it already exposes.
9. When consumer-style tests are difficult to write, improve the harness at the real boundary. Preserve the consumer workflow instead of bypassing it or introducing mocks to make the test easier.

## Example: distinct assertion ownership

A creation test verifies that a new record can be created and read. A rename test creates a record as setup, renames it, and asserts the new name. It should not repeat the initial creation or initial-name assertions. If a test concerns a transition, keep the observations needed to establish that transition together; the goal is distinct behavior coverage, not an arbitrary limit on assertion count.
