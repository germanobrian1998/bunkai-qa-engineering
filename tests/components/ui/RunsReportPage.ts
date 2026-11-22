import type { RunReportPage, RunReportTotals } from '@schemas/runs.types';
import type { TestContextOptions } from '@TestContext';
import type { InterceptedData } from '@ui/UiBase';

import { expect } from '@playwright/test';
import { UiBase } from '@ui/UiBase';
import { atc, step } from '@utils/decorators';

type Mode = 'all' | 'manual' | 'automated';
type Status = 'passed' | 'failed' | 'aborted';
type ModeTotal = 'manual' | 'automated';

const ACTIVE_WORKSPACE_COOKIE = 'bk_active_ws';
const REPORT_REQUEST = /\/runs\/report\?/;
const EXECUTORS_BY_MODE: Record<Mode, string[]> = { all: [], manual: ['human'], automated: ['agent', 'ci'] };
const MODE_LABEL: Record<Exclude<Mode, 'all'>, string> = { manual: 'Manual', automated: 'Automated' };
const EXECUTOR_LABEL: Record<Exclude<Mode, 'all'>, RegExp> = { manual: /^Human$/, automated: /^(Agent|CI)$/ };

export class RunsReportPage extends UiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  private readonly rows = () => this.page.getByTestId('report-rows').getByRole('row');
  private readonly modeGroup = () => this.page.getByTestId('report-filter-mode');
  private readonly modeButton = (mode: Mode) => this.page.getByTestId(`report-mode-${mode}`);
  private readonly total = (name: ModeTotal | 'passed' | 'failed') => this.page.getByTestId(`report-total-${name}`);
  private readonly loadOlder = () => this.page.getByTestId('report-load-older');
  private readonly totalsGroup = () => this.page.getByTestId('report-totals');

  private async open(args: { slug: string, workspaceId?: string }): Promise<void> {
    if (args.workspaceId) {
      await this.page.context().addCookies([{ name: ACTIVE_WORKSPACE_COOKIE, value: args.workspaceId, url: this.baseUrl }]);
    }
    await this.page.goto(this.buildUrl(`/projects/${args.slug}/runs`));
    await expect(this.page.getByTestId('report-filters')).toBeVisible();
  }

  private async selectMode(mode: Mode): Promise<InterceptedData<unknown, RunReportPage>> {
    return this.interceptResponse<unknown, RunReportPage>({
      action: async () => this.modeButton(mode).click(),
      urlPattern: REPORT_REQUEST,
    });
  }

  private async expectRowBadges(mode: Exclude<Mode, 'all'>): Promise<void> {
    for (const row of await this.rows().all()) {
      const badge = row.getByTestId('run-mode-badge');
      await expect(badge).toHaveAttribute('data-mode', mode);
      await expect(badge).toHaveText(MODE_LABEL[mode]);
      await expect(badge.locator('svg')).toHaveCount(1);
    }
  }

  @step
  async goto(args: { slug: string, workspaceId?: string }): Promise<void> {
    await this.open(args);
  }

  @step
  async readTotals(): Promise<RunReportTotals> {
    await expect(this.totalsGroup()).not.toContainText('—');
    await expect(this.totalsGroup()).not.toContainText('Aborted');
    const read = async (name: ModeTotal | 'passed' | 'failed') => Number.parseInt((await this.total(name).innerText()).replace(/\D+/g, ''), 10);
    return {
      passed: await read('passed'),
      failed: await read('failed'),
      manual: await read('manual'),
      automated: await read('automated'),
    };
  }

  @step
  async readScopeLabel(): Promise<string> {
    await expect(this.totalsGroup()).not.toContainText('Fetching runs');
    return (await this.page.getByTestId('report-scope-label').innerText()).trim();
  }

  @step
  async countRows(): Promise<number> {
    return this.rows().count();
  }

  @step
  async listRowIds(): Promise<string[]> {
    return this.page.getByTestId('report-rows').locator('tr[data-testid^="report-row-"]').evaluateAll(
      elements => elements.map(element => (element.getAttribute('data-testid') ?? '').replace('report-row-', '')),
    );
  }

  @step
  async applyMode(mode: Mode): Promise<void> {
    await this.selectMode(mode);
  }

  @step
  async applyStatus(status: Status): Promise<void> {
    await this.interceptResponse<unknown, RunReportPage>({
      action: async () => this.page.getByTestId(`report-status-${status}`).click(),
      urlPattern: REPORT_REQUEST,
    });
  }

  @atc('BK-1963')
  async filterRunsByMode(args: { mode: Exclude<Mode, 'all'>, expectedRows: number }): Promise<void> {
    const { mode, expectedRows } = args;
    const { url } = await this.selectMode(mode);

    const params = new URL(url).searchParams;
    expect(params.getAll('executor').sort()).toEqual(EXECUTORS_BY_MODE[mode]);
    expect(params.has('mode')).toBe(false);

    await expect(this.rows()).toHaveCount(expectedRows);
    await this.expectRowBadges(mode);
    for (const row of await this.rows().all()) {
      await expect(row.locator('td:nth-child(5)')).toHaveText(EXECUTOR_LABEL[mode]);
    }

    await expect(this.page.getByTestId('report-executor-human')).toHaveAttribute('aria-pressed', String(mode === 'manual'));
    await expect(this.page.getByTestId('report-executor-agent')).toHaveAttribute('aria-pressed', String(mode === 'automated'));
    await expect(this.page.getByTestId('report-executor-ci')).toHaveAttribute('aria-pressed', String(mode === 'automated'));
    await expect(this.modeButton(mode)).toHaveAttribute('aria-pressed', 'true');
    await expect(this.modeGroup()).toHaveAttribute('data-mode-state', mode);
  }

  @atc('BK-1967')
  async loadOlderRunsUnderMode(args: {
    mode: 'automated'
    expected: { manual: number, automated: number, pageOneRows: number, rowsAfterPageTwo: number }
  }): Promise<void> {
    const { mode, expected } = args;
    await this.selectMode(mode);

    await expect(this.total('manual')).toHaveText(`Manual ${expected.manual}`);
    await expect(this.total('automated')).toHaveText(`Automated ${expected.automated}`);
    await expect(this.rows()).toHaveCount(expected.pageOneRows);
    await expect(this.loadOlder()).toBeVisible();
    await this.expectRowBadges(mode);

    const { url } = await this.interceptResponse<unknown, RunReportPage>({
      action: async () => this.loadOlder().click(),
      urlPattern: /\/runs\/report\?.*cursor=/,
    });
    const params = new URL(url).searchParams;
    expect(params.getAll('executor').sort()).toEqual(EXECUTORS_BY_MODE[mode]);
    expect(params.get('cursor')?.length).toBeGreaterThan(0);

    await expect(this.rows()).toHaveCount(expected.rowsAfterPageTwo);
    await expect(this.page.locator('[data-testid="run-mode-badge"][data-mode="manual"]')).toHaveCount(0);
    await expect(this.loadOlder()).toBeHidden();
    await expect(this.total('manual')).toHaveText(`Manual ${expected.manual}`);
    await expect(this.total('automated')).toHaveText(`Automated ${expected.automated}`);
  }

  @atc('BK-1992')
  async openEmptyProjectUnderMode(args: { slug: string, workspaceId: string, mode: Mode }): Promise<void> {
    const { slug, workspaceId, mode } = args;
    await this.open({ slug, workspaceId });
    if (mode !== 'all') {
      await this.selectMode(mode);
    }

    await expect(this.page.getByTestId('report-empty-no-runs')).toContainText('No runs yet for this Project');
    await expect(this.page.getByTestId('report-empty-no-match')).toBeHidden();
    await expect(this.page.getByTestId('report-empty-no-automated')).toBeHidden();
    await expect(this.modeGroup()).toHaveAttribute('data-mode-state', mode);
    await expect(this.modeButton(mode)).toHaveAttribute('aria-pressed', 'true');
  }
}
