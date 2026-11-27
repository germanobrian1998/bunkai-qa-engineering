import type { TestContextOptions } from '@TestContext';

import { ACTIVE_WORKSPACE_COOKIE } from '@data/constants';
import { expect } from '@playwright/test';
import { UiBase } from '@ui/UiBase';
import { activeWorkspaceCookie } from '@utils/cookies';
import { step } from '@utils/decorators';

const ROW_TESTID_PREFIX = 'tests-list-row-';

export class TestsListPage extends UiBase {
  private readonly tagFilter = () => this.page.getByTestId('test-tag-filter');
  private readonly rows = () => this.page.locator(`[data-testid^="${ROW_TESTID_PREFIX}"]`);

  constructor(options: TestContextOptions) {
    super(options);
  }

  @step
  async open(args: { projectSlug: string, workspaceId: string }): Promise<void> {
    await this.page.context().addCookies([activeWorkspaceCookie({ name: ACTIVE_WORKSPACE_COOKIE, workspaceId: args.workspaceId, hostUrl: this.baseUrl })]);
    await this.page.goto(this.buildUrl(`/projects/${args.projectSlug}/tests`));
    await expect(this.tagFilter()).toBeVisible();
  }

  @step
  async filterByTag(tag: string): Promise<void> {
    const lookup = this.page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === '/api/v1/tests' && url.searchParams.get('tag') === tag;
    });
    await this.tagFilter().fill(tag);
    expect((await lookup).status()).toBe(200);
  }

  @step
  async expectFilteredRows(args: { ids: string[] }): Promise<void> {
    const expected = args.ids.map(id => `${ROW_TESTID_PREFIX}${id}`);
    await expect.poll(
      async () => this.rows().evaluateAll(elements => elements.map(element => element.getAttribute('data-testid'))),
      { message: 'the list shows exactly the Tests the tag filter returned, in the same order' },
    ).toEqual(expected);
  }
}
