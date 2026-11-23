/**
 * KATA Architecture - Playwright Configuration
 *
 * Comprehensive configuration for E2E and Integration testing
 * with Allure reporting and multi-environment support.
 *
 * IMPORTANT: All environment variables come from @variables.ts
 * This file should NOT read process.env directly (single source of truth).
 */

import { defineConfig, devices } from '@playwright/test';
import { config, env } from '@variables';

// Use values from centralized config (no direct process.env access)
const baseURL = config.baseUrl;

// Specs that need role sessions (BK-572). Owned by the *-roles projects only.
const ROLE_SPECS = ['**/workspace/members/**', '**/runs/report/**', '**/integration/**/account/display-name/**', '**/test-lifecycle/**'];

// Gate: the role projects (role-sessions-setup, *-roles) are active ONLY on staging
// AND with all four role accounts set (e.g. CI without the role secrets skips them);
// otherwise they keep their names but select no tests and depend on nothing.
const rolesEnabled = config.hasRoleUsers();
if (env.isStaging && !rolesEnabled) {
  console.warn('[playwright.config] Role projects disabled: staging role accounts (STAGING_ADMIN_*, STAGING_MEMBER_*, STAGING_VIEWER_*) are not all set. BK-572 member-removal specs will not run.');
}
const NO_TESTS = /\b\B/; // never matches
const BASE_IGNORE = ['**/module-example/**', ...ROLE_SPECS];
const roleMatch = (pattern: string | string[]) => (rolesEnabled ? pattern : NO_TESTS);
const roleDeps = (deps: string[]) => (rolesEnabled ? [...deps, 'role-sessions-setup'] : []);

/**
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.test\.ts/,
  // Exclude example files - they are reference templates, not functional tests
  testIgnore: ['**/module-example/**'],

  fullyParallel: false,
  forbidOnly: !!process.env.CI,

  // KATA Recommendation: Avoid retries - tests should be deterministic
  // If a test fails, investigate immediately rather than masking with retries
  retries: 0,

  // Single worker for now - increase when tests are stable and parallelizable
  workers: 1,

  timeout: 60000,
  expect: {
    timeout: 10000,
  },

  reporter: [
    // KataReporter: Rich terminal output with step-by-step logging
    // Always active for better debugging in both local and CI environments
    ['./tests/KataReporter.ts'],

    // HTML Report: Visual report with screenshots and traces
    ['html', { outputFolder: 'playwright-report', open: 'never' }],

    // JSON Report: Machine-readable results for CI integrations
    ['json', { outputFile: 'test-results/results.json' }],

    // JUnit Report: XML format for CI tools (Jenkins, Azure DevOps, etc.)
    ['junit', { outputFile: 'test-results/junit.xml' }],

    // Allure Report: Comprehensive test reporting with history and trends
    // See: https://allurereport.org/docs/playwright-configuration
    [
      'allure-playwright',
      {
        resultsDir: config.reporting.allureResultsDir,
        detail: true,
        suiteTitle: true,
        categories: [
          { name: 'Outdated tests', messageRegex: '.*test is outdated.*' },
          { name: 'Product defects', messageRegex: '.*Expect.*', matchedStatuses: ['failed'] },
        ],
        environmentInfo: {
          Environment: env.current,
          BaseURL: baseURL,
          CI: env.isCI ? 'Yes' : 'No',
          NodeVersion: process.version,
        },
      },
    ],

    // GitHub Reporter (optional): Generates annotations in GitHub Actions UI
    // Uncomment to enable inline error annotations in PR file views
    // Note: Not recommended with matrix strategies (errors multiply in UI)
    // See: https://playwright.dev/docs/test-reporters#github-actions-annotations
    // ...(env.isCI ? [['github'] as const] : []),
  ],

  use: {
    baseURL,
    // `retain-on-failure` on BOTH sides, deliberately. `on-first-retry` was the
    // local value, and `retries: 0` above means there is never a first retry —
    // so a local failure produced no trace at all, which is the one artifact
    // you need for the failure you just got.
    trace: 'retain-on-failure',
    screenshot: config.reporting.screenshotOnFailure ? 'only-on-failure' : 'off',
    video: env.isCI && config.reporting.videoOnFailure ? 'retain-on-failure' : 'off',
    headless: env.isCI || config.browser.headless,
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
    actionTimeout: config.browser.defaultTimeout / 2,
    navigationTimeout: config.browser.defaultTimeout,
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en',
    },
  },

  projects: [
    // ============================================
    // Global Setup - Runs FIRST (creates dirs, validates env)
    // ============================================
    {
      name: 'global-setup',
      testMatch: /global\.setup\.ts/,
      testDir: './tests/setup',
      teardown: 'global-teardown',
    },

    // ============================================
    // Auth Setup Projects - Run after global-setup
    // ============================================
    {
      name: 'ui-setup',
      testMatch: /ui-auth\.setup\.ts/,
      testDir: './tests/setup',
      dependencies: ['global-setup'],
    },
    {
      name: 'api-setup',
      testMatch: /api-auth\.setup\.ts/,
      testDir: './tests/setup',
      dependencies: ['global-setup'],
    },

    // Role sessions: one cookie storageState per workspace role
    // (.auth/role-<role>.json). Opt-in: a project or spec that needs role
    // sessions declares `dependencies: ['role-sessions-setup']`. The *-roles
    // projects below own the specs under `workspace/members/` (BK-572) so the
    // default e2e, integration and smoke projects never sign in four roles.
    {
      name: 'role-sessions-setup',
      testMatch: rolesEnabled ? /role-sessions\.setup\.ts/ : NO_TESTS,
      testDir: './tests/setup',
      dependencies: ['global-setup'],
    },

    // ============================================
    // E2E Tests - UI + API with authenticated session
    // ============================================
    {
      name: 'e2e',
      use: {
        ...devices['Desktop Chrome'],
        storageState: config.auth.storageStatePath,
      },
      testMatch: '**/e2e/**/*.test.ts',
      testIgnore: BASE_IGNORE,
      dependencies: ['ui-setup'],
    },
    {
      name: 'e2e-roles',
      use: {
        ...devices['Desktop Chrome'],
        storageState: config.auth.storageStatePath,
      },
      testMatch: roleMatch(['**/e2e/**/workspace/members/**/*.test.ts', '**/e2e/**/runs/report/**/*.test.ts', '**/e2e/**/test-lifecycle/**/*.test.ts']),
      dependencies: roleDeps(['ui-setup']),
    },

    // ============================================
    // Integration Tests - API only with token
    // ============================================
    {
      name: 'integration',
      testMatch: '**/integration/**/*.test.ts',
      testIgnore: BASE_IGNORE,
      dependencies: ['api-setup'],
      use: {},
    },
    {
      name: 'integration-roles',
      testMatch: roleMatch(['**/integration/**/workspace/members/**/*.test.ts', '**/integration/**/runs/report/**/*.test.ts', '**/integration/**/account/display-name/**/*.test.ts', '**/integration/**/test-lifecycle/**/*.test.ts']),
      dependencies: roleDeps(['api-setup']),
      use: {},
    },

    // ============================================
    // Smoke Tests - @critical tagged tests, ONE PROJECT PER SURFACE
    // Usage: bun run test:smoke  (runs both)
    //
    // Split on purpose. A single `smoke` project spanning `{e2e,integration}`
    // has to pick ONE `use` block, and it picked the UI one — which handed a
    // browser storageState to API tests. That storage state carries the
    // session COOKIE, so `api.clearAuthToken()` (which only nulls the Bearer
    // header) left the request authenticated: `UPEX-100: should fail without
    // token` asserted 401 and got 200, passing under `--project=integration`
    // and failing under `--project=smoke`. A project that spans two surfaces
    // cannot carry one surface's auth state.
    //
    // Each half now mirrors its full-suite sibling exactly, plus the grep:
    // `smoke-ui` == `e2e` + @critical, `smoke-api` == `integration` + @critical.
    // ============================================
    {
      name: 'smoke-ui',
      grep: /@critical/,
      testMatch: '**/e2e/**/*.test.ts',
      testIgnore: BASE_IGNORE,
      dependencies: ['ui-setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: config.auth.storageStatePath,
      },
    },
    {
      name: 'smoke-api',
      grep: /@critical/,
      testMatch: '**/integration/**/*.test.ts',
      testIgnore: BASE_IGNORE,
      dependencies: ['api-setup'],
      use: {},
    },
    // Role smoke: @smoke grep (TC6 and TC14 only), only the role-session specs. One
    // project per surface for the same storageState reason as above.
    {
      name: 'smoke-roles-ui',
      grep: /@smoke/,
      testMatch: roleMatch(['**/e2e/**/workspace/members/**/*.test.ts', '**/e2e/**/runs/report/**/*.test.ts', '**/e2e/**/test-lifecycle/**/*.test.ts']),
      dependencies: roleDeps(['ui-setup']),
      use: {
        ...devices['Desktop Chrome'],
        storageState: config.auth.storageStatePath,
      },
    },
    {
      name: 'smoke-roles-api',
      grep: /@smoke/,
      testMatch: roleMatch(['**/integration/**/workspace/members/**/*.test.ts', '**/integration/**/runs/report/**/*.test.ts', '**/integration/**/test-lifecycle/**/*.test.ts']),
      dependencies: roleDeps(['api-setup']),
      use: {},
    },

    // ============================================
    // Global Teardown - Runs LAST (reports, TMS sync)
    // Activated by `teardown` property on global-setup, NOT by dependencies
    // ============================================
    {
      name: 'global-teardown',
      testMatch: /global\.teardown\.ts/,
      testDir: './tests/teardown',
    },

    // ============================================
    // Sandbox - Isolated tests without dependencies (for debugging/experiments)
    // Usage: bunx --bun playwright test --project=sandbox
    // ============================================
    {
      name: 'sandbox',
      testMatch: /.*\.sandbox\.ts/,
      // No dependencies - runs completely isolated
    },
  ],

  // Artifacts directory (add to .gitignore)
  // Contains: screenshots, videos, traces, test results
  outputDir: 'test-results',
});
