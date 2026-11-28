import type { TestContextOptions } from '@TestContext';

import { ACTIVE_WORKSPACE_COOKIE } from '@data/constants';
import { expect } from '@playwright/test';
import { UiBase } from '@ui/UiBase';
import { activeWorkspaceCookie } from '@utils/cookies';
import { step } from '@utils/decorators';

const ROW_TESTID_PREFIX = 'tests-list-row-';
const LOOKUP_ATTEMPT_TIMEOUT_MS = 4_000;
const LOOKUP_TIMEOUT_MS = 20_000;

export class TestsListPage extends UiBase {
  private readonly tagFilter = () => this.page.getByTestId('test-tag-filter');

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
    await expect(async () => {
      const lookup = this.page.waitForResponse(
        (response) => {
          const url = new URL(response.url());
          return url.pathname === '/api/v1/tests' && url.searchParams.get('tag') === tag;
        },
        { timeout: LOOKUP_ATTEMPT_TIMEOUT_MS },
      );
      await this.tagFilter().fill('');
      await this.tagFilter().fill(tag);
      expect((await lookup).status()).toBe(200);
    }, { message: 'the tag filter fires its lookup once the page has hydrated' }).toPass({ timeout: LOOKUP_TIMEOUT_MS });
  }

  @step
  async expectFilteredRows(args: { ids: string[] }): Promise<void> {
    await expect(this.page.getByTestId('tests-list-error'), 'the tag lookup did not fail').toBeHidden();
    if (args.ids.length === 0) {
      await expect(this.page.getByTestId('tests-list-no-match'), 'the applied tag matches no Test').toBeVisible();
      return;
    }
    await expect(this.page.getByTestId('tests-list-table'), 'the list left its pending state and shows rows').toBeVisible();
    const expected = args.ids.map(id => `${ROW_TESTID_PREFIX}${id}`);
    await expect.poll(
      async () => this.page.locator(`[data-testid^="${ROW_TESTID_PREFIX}"]`).evaluateAll(elements => elements.map(element => element.getAttribute('data-testid'))),
      { message: 'the list shows exactly the Tests the tag filter returned, in the same order' },
    ).toEqual(expected);
  }

  @step
  async expectRowTitle(args: { testId: string, title: string }): Promise<void> {
    await expect(
      this.page.getByTestId(`tests-list-open-${args.testId}`),
      'the Tests list row shows the Test under its new title',
    ).toContainText(args.title);
  }
}
