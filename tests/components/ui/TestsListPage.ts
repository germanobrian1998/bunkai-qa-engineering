import type { TestContextOptions } from '@TestContext';

import { ACTIVE_WORKSPACE_COOKIE } from '@data/constants';
import { expect } from '@playwright/test';
import { UiBase } from '@ui/UiBase';
import { activeWorkspaceCookie } from '@utils/cookies';
import { step } from '@utils/decorators';

export class TestsListPage extends UiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  @step
  async open(args: { projectSlug: string, workspaceId: string }): Promise<void> {
    await this.page.context().addCookies([activeWorkspaceCookie({ name: ACTIVE_WORKSPACE_COOKIE, workspaceId: args.workspaceId, hostUrl: this.baseUrl })]);
    await this.page.goto(this.buildUrl(`/projects/${args.projectSlug}/tests`));
    await expect(this.page.getByTestId('test-tag-filter')).toBeVisible();
  }

  @step
  async filterByTag(tag: string): Promise<void> {
    await this.page.getByTestId('test-tag-filter').fill(tag);
  }

  @step
  async expectFilteredRows(args: { present: string[], absent: string[] }): Promise<void> {
    if (args.present.length === 0) {
      await expect(this.page.getByTestId('tests-list-no-match')).toBeVisible();
    }
    for (const id of args.present) {
      await expect(this.page.getByTestId(`tests-list-row-${id}`)).toBeVisible();
    }
    for (const id of args.absent) {
      await expect(this.page.getByTestId(`tests-list-row-${id}`)).toHaveCount(0);
    }
  }
}
