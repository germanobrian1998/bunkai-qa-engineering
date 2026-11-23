import type { TestContextOptions } from '@TestContext';

import { expect } from '@playwright/test';
import { UiBase } from '@ui/UiBase';
import { step } from '@utils/decorators';

const ACTIVE_WORKSPACE_COOKIE = 'bk_active_ws';

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
  async expectRenameError(args: { title: string, message: string }): Promise<void> {
    await this.page.getByTestId('test-detail-rename').click();
    await this.page.getByTestId('test-rename-input').fill(args.title);
    await this.page.getByTestId('test-rename-save').click();
    await expect(this.page.getByTestId('test-rename-error')).toHaveText(args.message);
  }
}
