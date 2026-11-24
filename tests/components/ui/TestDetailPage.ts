import type { Request } from '@playwright/test';
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
  async open(args: { projectSlug: string, testId: string, workspaceId: string }): Promise<void> {
    await this.page.context().addCookies([{ name: ACTIVE_WORKSPACE_COOKIE, value: args.workspaceId, url: this.baseUrl }]);
    await this.page.goto(this.buildUrl(`/projects/${args.projectSlug}/tests/${args.testId}`));
    await expect(this.page.getByTestId('test-tabs')).toBeVisible();
  }

  @step
  async expectFrozen(): Promise<void> {
    await expect(this.page.getByTestId('test-archived-banner')).toBeVisible();
    await expect(this.page.getByTestId('test-detail-rename')).toHaveCount(0);
    await expect(this.page.getByTestId('test-tag-editor-open')).toHaveCount(0);
    await expect(this.page.getByTestId('test-reorder-bar')).toHaveCount(0);
    await expect(this.page.getByLabel(/^Drag to reorder ATC/)).toHaveCount(0);
  }

  @step
  async expectNoWriteControls(): Promise<void> {
    await expect(this.page.getByTestId('test-tabs')).toBeVisible();
    await expect(this.page.getByTestId('test-detail-rename')).toHaveCount(0);
    await expect(this.page.getByTestId('test-detail-archive')).toHaveCount(0);
    await expect(this.page.getByTestId('test-detail-restore')).toHaveCount(0);
  }

  @step
  async expectBlankRenameBlocked(args: { testId: string, message: string }): Promise<void> {
    const patches: string[] = [];
    const onRequest = (request: Request): void => {
      if (request.method() === 'PATCH' && request.url().endsWith(`/api/v1/tests/${args.testId}`)) {
        patches.push(request.url());
      }
    };
    this.page.on('request', onRequest);
    try {
      await this.page.getByTestId('test-detail-rename').click();
      await this.page.getByTestId('test-rename-input').fill('');
      await this.page.getByTestId('test-rename-save').click();
      await expect(this.page.getByTestId('test-rename-error')).toHaveText(args.message);
      expect(patches, 'a blank rename must not leave the page').toEqual([]);
    }
    finally {
      this.page.off('request', onRequest);
    }
  }
}
