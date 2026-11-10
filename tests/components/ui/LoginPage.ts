/**
 * KATA Architecture - Layer 3: Login Page Component
 *
 * UI component for authentication via the login page.
 * Handles login flows for E2E tests.
 *
 * Page: /login (Bunkai), two-step email-first form
 * Locators (data-testid):
 * - Email: login-email, then Continue: login-continue
 * - Password: login-password, then Sign in: login-signin
 * - Error: login-error
 * - Post-login shell: sidebar-search
 */

import type { TestContextOptions } from '@TestContext';

import { expect } from '@playwright/test';
import { UiBase } from '@ui/UiBase';
import { atc, step } from '@utils/decorators';

// ============================================
// Types - Login data structures
// ============================================

/**
 * Login credentials for UI authentication
 * Note: Bunkai signs in with 'email' (no username)
 */
export interface LoginCredentials {
  email: string
  password: string
}

// ============================================
// Login Page Component
// ============================================

export class LoginPage extends UiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers (Private)
  // ============================================

  /**
   * Fill login form and submit
   * Helper that combines fill + submit actions
   */
  private async fillAndSubmitLoginForm(credentials: LoginCredentials): Promise<void> {
    await this.page.getByTestId('login-email').fill(credentials.email);
    await this.page.getByTestId('login-continue').click();
    await this.page.getByTestId('login-password').fill(credentials.password);
    await this.page.getByTestId('login-signin').click();
  }

  // ============================================
  // Navigation (Public)
  // ============================================

  /**
   * Navigate to the login page
   * Call this BEFORE using login ATCs
   */
  @step
  async goto(): Promise<void> {
    await this.page.goto(this.buildUrl('/login'));
  }

  // ============================================
  // ATCs - Complete Test Cases
  // ============================================

  /**
   * ATC: Login with valid credentials - expects success
   *
   * IMPORTANT: Call goto() before this ATC.
   * Fills credentials, submits, and verifies redirect away from login page.
   *
   * @param credentials - Email and password
   */
  @atc('BK-313')
  async loginSuccessfully(credentials: LoginCredentials): Promise<void> {
    await this.fillAndSubmitLoginForm(credentials);

    // Wait for authentication to complete and redirect to the app shell
    await this.page.waitForURL(/\/(projects|onboarding)/, { timeout: 15000 });
    await expect(this.page).not.toHaveURL(/\/login/);
    await expect(this.page.getByTestId('sidebar-search')).toBeVisible();
  }

  /**
   * ATC: Login with invalid credentials - expects error
   *
   * IMPORTANT: Call goto() before this ATC.
   * Fills invalid credentials, submits, and verifies error message.
   *
   * @param credentials - Invalid email or password
   */
  @atc('BK-314')
  async loginWithInvalidCredentials(credentials: LoginCredentials): Promise<void> {
    await this.fillAndSubmitLoginForm(credentials);

    // Fixed assertion - error should be visible and the user stays on /login
    await expect(this.page.getByTestId('login-error')).toBeVisible({ timeout: 5000 });
    await expect(this.page).toHaveURL(/\/login/);
  }
}
