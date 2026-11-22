/**
 * KATA Architecture - Layer 4: UI Fixture
 *
 * Dependency Injection container for all UI components.
 * Provides unified access to UI testing capabilities.
 *
 * All UI components share the same page context from TestContext,
 * ensuring consistent browser state across components.
 *
 * HOW TO ADD NEW UI COMPONENTS:
 * 1. Create your component in tests/components/ui/YourPage.ts
 * 2. Import it here
 * 3. Add as readonly property
 * 4. Initialize in constructor passing the options
 */

import type { TestContextOptions } from '@TestContext';

import { LoginPage } from '@ui/LoginPage';
import { MembersPage } from '@ui/MembersPage';
import { RunsReportPage } from '@ui/RunsReportPage';
import { UiBase } from '@ui/UiBase';

// ============================================
// UI Fixture Class
// ============================================

export class UiFixture extends UiBase {
  /** Login page component - handles authentication flows */
  readonly login: LoginPage;

  /** Members page component - workspace members screen and removal */
  readonly members: MembersPage;

  /** Runs report page component - project Runs view and its Mode filter */
  readonly runsReport: RunsReportPage;

  constructor(options: TestContextOptions) {
    super(options);

    // All components receive the same options (same page context)
    this.login = new LoginPage(options);
    this.members = new MembersPage(options);
    this.runsReport = new RunsReportPage(options);
  }
}
