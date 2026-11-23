import type { TestContextOptions } from '@TestContext';

import { ACTIVE_WORKSPACE_COOKIE } from '@data/constants';
import { expect } from '@playwright/test';
import { UiBase } from '@ui/UiBase';
import { step } from '@utils/decorators';

export class TestDetailPage extends UiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  @step
  async goto(args: { projectSlug: string, testId: string, workspaceId: string }): Promise<void> {
    await this.page.context().addCookies([{ name: ACTIVE_WORKSPACE_COOKIE, value: args.workspaceId, url: this.baseUrl }]);
    await this.page.goto(this.buildUrl(`/projects/${args.projectSlug}/tests/${args.testId}`));
    await expect(this.page.getByTestId('test-detail-rename')).toBeVisible();
  }

  @step
  async expectBlankRenameBlocked(args: { testId: string, message: string }): Promise<void> {
    const patches: string[] = [];
    this.page.on('request', (request) => {
      if (request.method() === 'PATCH' && request.url().endsWith(`/api/v1/tests/${args.testId}`)) {
        patches.push(request.url());
      }
    });
    await this.page.getByTestId('test-detail-rename').click();
    await this.page.getByTestId('test-rename-input').fill('');
    await this.page.getByTestId('test-rename-save').click();
    await expect(this.page.getByTestId('test-rename-error')).toHaveText(args.message);
    expect(patches, 'a blank rename must not leave the page').toEqual([]);
  }
}
