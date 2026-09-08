---
name: testing
description: Choose, write, and review tests that exercise real consumer behavior, prioritize successful workflows, and give each test distinct coverage. Use when adding, changing, or reviewing Vitest tests, Playwright end-to-end tests, or their harnesses.
---

# Testing

Use Vitest for service, API, and library tests, and Playwright for UI end-to-end tests. These conventions apply across projects.

# Principles

- Services are code programs and modules to be tested. Services can compose multiple sub-services. E.g. electron app is a service that uses the renderer and main process as sub-services.
- Services receive events in, and emit events out.
- A driver of a service sends events in, and expects some events out.
  - An API request a server returns some response
  - Clicking on a link in the app opens the page
- Tests are meant to test a service. Services can theoretically be used in multiple different ways:
  - a human is driving the service
  - an agent is driving the service
  - the service is being used programmatically (code is driving the service)
  - the test is driving the service
- In all scenarios, the service should be used identically, so we know the tests are representative of real usage. Importantly, this means: the behavior of a service during a test should be as identical as possible to other situations:
  - No mocks
  - Minimize test-specific configuration
- Tests are generally composed of 3 phases: setup, action, assertion
  - Setup: Service is driven into the state being tested. Previous tests cover correctness of these actions
  - Action: an action is taken on the service
  - Assertion: we verify the service and external state is as we expect
- Tests should be as readable as possible. That means every line in a test should be one of two things:
  - An assertion or setup for an assertion (minimal)
  - A single action taken on the service, which should correspond to the same actions available to human, agent, or code drivers.
- Boilerplate setup/assertion does not belong in a test - file it in Vitest fixtures as much as possible.
- Tests should be isolated and unique. They should not re-test correctness already verified in other tests.
- Services can be made up of sub-services. Tests should not test the data flow internally between sub-services - these are considered implementation details. Only test the externally visible outcomes.
  - Examples of implementation details:
    - Asserting a server sends a specific request to another server - just test the response back to the driver
    - Asserting it updates an internal database with specific rows - instead, ask if it did update properly, what end-driver outcome could we measure/see?
  - Examples of externally visible outcomes
    - Asserting that a file is really deleted in the filesystem after deleting it in the app. The filesystem is not an implementation detail if the driver expects to interact with it not through the app. But if the filesystem is being used to store an internal db that’s not meant to be directly used by drivers, then it would be considered an implementation detail.
- The fixtures available to a test code driver should be the following
  - The service being tested, able to send events to it at the same fidelity as other drivers.
    - E.g. for a web page, this might be the playwright page. For a server, it’s the ability to directly call routes.
  - External services that should be visible to the driver. Examples:
    - For sync engine, this could be a timer object, and a secondary client
    - For web pages, it could be a second client/browser to load the same web page and assert some change propagated
  - Different drivers (like code, human, agent) might have different external services exposed to them. The test should contain the union of these. Don’t add external services that might plausibly be used by other drivers, until we decide behavior on those services should be tested.
