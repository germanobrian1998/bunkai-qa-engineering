import type { Locator, Request } from '@playwright/test';
import type { RenameTestResponse, RestoreTestResponse } from '@schemas/tests.types';
import type { TestContextOptions } from '@TestContext';

import { ACTIVE_WORKSPACE_COOKIE } from '@data/constants';
import { expect } from '@playwright/test';
import { UiBase } from '@ui/UiBase';
import { activeWorkspaceCookie } from '@utils/cookies';
import { atc, step } from '@utils/decorators';

const REORDER_HANDLE = /^test-reorder-handle-/;
const CONTENT_TIMEOUT_MS = 30_000;

const LIFECYCLE_CONTROLS = {
  live: ['test-detail-rename', 'test-detail-archive'],
  archived: ['test-detail-restore'],
} as const;

export class TestDetailPage extends UiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  private async navigate(args: { projectSlug: string, testId: string, workspaceId: string }): Promise<void> {
    await this.page.context().addCookies([activeWorkspaceCookie({ name: ACTIVE_WORKSPACE_COOKIE, workspaceId: args.workspaceId, hostUrl: this.baseUrl })]);
    await this.page.goto(this.buildUrl(`/projects/${args.projectSlug}/tests/${args.testId}`), { waitUntil: 'commit' });
  }

  private async openByClick(args: { trigger: Locator, opened: Locator }): Promise<void> {
    await expect(async () => {
      if (!(await args.opened.isVisible())) {
        await args.trigger.click({ timeout: 2_000 });
      }
      await expect(args.opened).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: CONTENT_TIMEOUT_MS });
  }

  @step
  async goto(args: { projectSlug: string, testId: string, workspaceId: string }): Promise<void> {
    await this.navigate(args);
    await expect(this.page.getByTestId('test-detail-rename')).toBeVisible({ timeout: CONTENT_TIMEOUT_MS });
  }

  @step
  async open(args: { projectSlug: string, testId: string, workspaceId: string }): Promise<void> {
    await this.navigate(args);
    await expect(this.page.getByTestId('test-tabs')).toBeVisible({ timeout: CONTENT_TIMEOUT_MS });
  }

  @step
  async expectFrozen(): Promise<void> {
    await expect(this.page.getByTestId('test-archived-banner')).toBeVisible();
    await expect(this.page.getByTestId('test-detail-rename')).toHaveCount(0);
    await expect(this.page.getByTestId('test-tag-editor-open')).toHaveCount(0);
    await expect(this.page.getByTestId(REORDER_HANDLE)).toHaveCount(0);
  }

  @step
  async expectEditControlsOffered(): Promise<void> {
    await expect(this.page.getByTestId('test-detail-rename')).toBeVisible();
    await expect(this.page.getByTestId('test-tag-editor-open')).toBeVisible();
    await expect(this.page.getByTestId(REORDER_HANDLE)).not.toHaveCount(0);
  }

  @step
  async expectLifecycleControlOffered(state: 'live' | 'archived'): Promise<void> {
    for (const testId of LIFECYCLE_CONTROLS[state]) {
      await expect(this.page.getByTestId(testId)).toBeVisible();
    }
  }

  @step
  async expectNoWriteControls(state: 'live' | 'archived'): Promise<void> {
    await expect(this.page.getByTestId('test-tabs')).toBeVisible();
    for (const testId of LIFECYCLE_CONTROLS[state]) {
      await expect(this.page.getByTestId(testId)).toHaveCount(0);
    }
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
      await this.openByClick({ trigger: this.page.getByTestId('test-detail-rename'), opened: this.page.getByTestId('test-rename-input') });
      await this.page.getByTestId('test-rename-input').fill('');
      await this.page.getByTestId('test-rename-save').click();
      await expect(this.page.getByTestId('test-rename-error')).toHaveText(args.message);
      expect(patches, 'a blank rename must not leave the page').toEqual([]);
    }
    finally {
      this.page.off('request', onRequest);
    }
  }

  @step
  async expectStartRunOffered(): Promise<void> {
    await expect(this.page.getByTestId('test-detail-rename'), 'the live Test page rendered its controls').toBeVisible();
    await expect(this.page.getByTestId('start-run-button'), 'a live Test offers Start Run').toBeVisible();
  }

  @step
  async expectNoStartRun(): Promise<void> {
    await expect(this.page.getByTestId('test-archived-banner'), 'the archived Test page rendered its content').toBeVisible();
    await expect(this.page.getByTestId('start-run-button'), 'an archived Test offers no Start Run').toHaveCount(0);
    await expect(this.page.getByTestId('start-run-env')).toHaveCount(0);
  }

  @step
  async expectTitleInExplorer(args: { testId: string, title: string }): Promise<void> {
    await expect(
      this.page.getByTestId(`explorer-test-${args.testId}`),
      'the explorer lists the Test under the expected title',
    ).toContainText(args.title, { timeout: CONTENT_TIMEOUT_MS });
  }

  @step
  async expectExplorerRowAbsent(args: { testId: string, listedTestId: string }): Promise<void> {
    await expect(
      this.page.getByTestId(`explorer-test-${args.listedTestId}`),
      'the explorer has loaded its Tests: a live Test of the same project is listed',
    ).toBeVisible({ timeout: CONTENT_TIMEOUT_MS });
    await expect(
      this.page.getByTestId(`explorer-test-${args.testId}`),
      'the explorer does not list the archived Test',
    ).toHaveCount(0);
  }

  @atc('BK-2140')
  async renameFromHeader(args: { title: string }): Promise<void> {
    const { title } = args;
    await this.openByClick({ trigger: this.page.getByTestId('test-detail-rename'), opened: this.page.getByTestId('test-rename-input') });
    await this.page.getByTestId('test-rename-input').fill(title);
    const { method, status, responseBody } = await this.interceptResponse<{ title: string }, RenameTestResponse>({
      urlPattern: /\/api\/v1\/tests\/[0-9a-f-]+$/,
      action: async () => this.page.getByTestId('test-rename-save').click(),
    });
    expect(method, 'the header rename sends a PATCH').toBe('PATCH');
    expect(status, 'the rename is accepted').toBe(200);
    expect(responseBody?.changed, 'the rename reports a change').toBe(true);
    expect(responseBody?.test.title, 'the response carries the new title').toBe(title);
    await expect(this.page.getByTestId('test-detail-title'), 'the header shows the new title').toHaveText(title);
  }

  @atc('BK-2144')
  async archiveFromTestPage(args: { title: string, runCount: number }): Promise<void> {
    const { title, runCount } = args;
    const dialog = this.page.getByTestId('archive-test-dialog');
    await this.openByClick({ trigger: this.page.getByTestId('test-detail-archive'), opened: dialog });
    await expect(dialog, 'the confirmation names the Test').toContainText(title);
    await expect(dialog, 'the confirmation states that archiving is reversible').toContainText(/reversible/i);
    await expect(
      this.page.getByTestId('archive-test-runs'),
      'the confirmation states the Run count and that the Runs are kept and readable',
    ).toHaveText(new RegExp(`^${runCount} Runs? ha(s|ve) been recorded\\..*\\bkept\\b.*\\breadable\\b`));
    const { method, status } = await this.interceptResponse({
      urlPattern: /\/api\/v1\/tests\/[0-9a-f-]+$/,
      action: async () => this.page.getByTestId('archive-test-confirm').click(),
    });
    expect(method, 'the confirmation sends a DELETE').toBe('DELETE');
    expect(status, 'the archive is accepted').toBe(204);
    await expect(
      this.page.locator('[data-sonner-toast]').filter({ hasText: title }),
      'the toast explains how to restore',
    ).toContainText(/restore/i);
    await expect(this.page.getByTestId('test-archived-banner'), 'the archived banner is shown').toBeVisible();
    await expect(this.page.getByTestId('test-archived-badge'), 'the archived badge is shown').toBeVisible();
    await expect(this.page.getByTestId('test-detail-restore'), 'the banner offers Restore').toBeVisible();
  }

  @atc('BK-2152')
  async restoreFromBanner(args: { chainLength: number }): Promise<void> {
    const urlPattern = /\/api\/v1\/tests\/[0-9a-f-]+\/restore$/;
    const restoreButton = this.page.getByTestId('test-detail-restore');
    let requests = 0;
    const onRequest = (request: Request): void => {
      if (request.method() === 'POST' && urlPattern.test(request.url())) {
        requests += 1;
      }
    };
    this.page.on('request', onRequest);
    try {
      const { method, status, responseBody } = await this.interceptResponse<unknown, RestoreTestResponse>({
        urlPattern,
        timeout: CONTENT_TIMEOUT_MS * 2,
        action: async () => {
          await expect(async () => {
            if (requests === 0 && await restoreButton.count() > 0 && await restoreButton.isEnabled()) {
              await restoreButton.click({ timeout: 2_000 });
            }
            expect(requests, 'the Restore click reached the page handler').toBeGreaterThan(0);
          }).toPass({ timeout: CONTENT_TIMEOUT_MS });
        },
      });
      expect(method, 'the banner restore sends a POST').toBe('POST');
      expect(status, 'the restore is accepted').toBe(200);
      expect(responseBody?.test.changed, 'the restore reports a change').toBe(true);
      expect(responseBody?.test.archived_at, 'the restored Test is no longer archived').toBeNull();
    }
    finally {
      this.page.off('request', onRequest);
    }
    await expect(this.page.getByTestId('test-archived-banner'), 'the archived banner is gone').toBeHidden({ timeout: CONTENT_TIMEOUT_MS });
    expect(requests, 'exactly one restore request was sent').toBe(1);
    await expect(this.page.getByTestId('start-run-button'), 'Start Run is offered again').toBeVisible();
    await expect(this.page.getByTestId('test-detail-rename'), 'rename is offered again').toBeVisible();
    await expect(this.page.getByTestId('test-tag-editor-open'), 'the tag editor is offered again').toBeVisible();
    await expect(this.page.getByTestId(REORDER_HANDLE), 'one reorder handle is offered per chain step').toHaveCount(args.chainLength);
  }
}
