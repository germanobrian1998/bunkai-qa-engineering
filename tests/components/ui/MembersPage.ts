/**
 * KATA Architecture - Layer 3: Members Page Component
 *
 * UI component for the workspace Members screen.
 *
 * Page: /workspaces/{workspaceId}/members
 * Locators (role + accessible name, confirmed against the live screen):
 * - Remove control: button named `Remove <email>` (absent when the ladder forbids)
 * - Confirmation: alertdialog "Remove teammate" naming the email; its confirm button is also named `Remove <email>`, so it is scoped to the dialog
 */

import type { TestContextOptions } from '@TestContext';

import { expect } from '@playwright/test';
import { UiBase } from '@ui/UiBase';
import { atc, step } from '@utils/decorators';

// ============================================
// Members Page Component
// ============================================

export class MembersPage extends UiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Navigation (Public)
  // ============================================

  /**
   * Navigate to the Members screen of a workspace.
   * Call this BEFORE the removal ATC.
   */
  @step
  async goto(workspaceId: string): Promise<void> {
    await this.page.goto(this.buildUrl(`/workspaces/${workspaceId}/members`));
  }

  // ============================================
  // ATCs - Complete Test Cases
  // ============================================

  /**
   * ATC: The Owner removes a Member from the Members screen and confirms.
   *
   * IMPORTANT: Call goto() before this ATC.
   *
   * Fixed assertions:
   * - the Remove control for the target exists on the row (accessible name `Remove <email>`)
   * - the confirmation (alertdialog) opens and names the target email
   * - the DELETE answers 200 and, after confirming, the dialog closes, the Remove control is gone and the roster list no longer names the email
   *
   * @param args - Workspace id and the email of the Member to remove
   */
  @atc('BK-1656')
  async removeMemberViaConfirmation(args: { workspaceId: string, memberEmail: string }): Promise<void> {
    const { workspaceId, memberEmail } = args;
    const removeButton = this.page.getByRole('button', { name: `Remove ${memberEmail}` });
    await expect(removeButton).toBeVisible();
    await removeButton.click();

    const dialog = this.page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(memberEmail);

    const removalPattern = new RegExp(`/api/v1/workspaces/${workspaceId}/members/[^/]+$`);
    const removalResponse = this.page.waitForResponse(
      response => response.request().method() === 'DELETE' && removalPattern.test(response.url()),
    );
    await dialog.getByRole('button', { name: `Remove ${memberEmail}` }).click();
    expect((await removalResponse).status()).toBe(200);

    await expect(dialog).toBeHidden();
    await expect(removeButton).toBeHidden();
    // The roster list is the one holding Remove controls; the email may still show elsewhere (activity feed)
    const roster = this.page.getByRole('list').filter({ has: this.page.getByRole('button', { name: /^Remove / }) });
    await expect(roster.getByText(memberEmail)).toHaveCount(0);
  }
}
