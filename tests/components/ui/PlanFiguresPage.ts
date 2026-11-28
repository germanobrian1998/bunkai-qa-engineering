import type { MilestoneFigure, PlanFigure, PlanFiguresBaseline, PlanFiguresScope } from '@data/types';
import type { TestContextOptions } from '@TestContext';

import { ACTIVE_WORKSPACE_COOKIE } from '@data/constants';
import { expect } from '@playwright/test';
import { UiBase } from '@ui/UiBase';
import { activeWorkspaceCookie } from '@utils/cookies';
import { atc, step } from '@utils/decorators';

function normalize(text: string): string {
  return text.replaceAll(/\s+/g, ' ').trim();
}

export class PlanFiguresPage extends UiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  private async scopeToWorkspace(workspaceId: string): Promise<void> {
    await this.page.context().addCookies([activeWorkspaceCookie({ name: ACTIVE_WORKSPACE_COOKIE, workspaceId, hostUrl: this.baseUrl })]);
  }

  private async readPlan(args: { projectSlug: string, planId: string }): Promise<PlanFigure> {
    await this.page.goto(this.buildUrl(`/projects/${args.projectSlug}/plans/${args.planId}`), { waitUntil: 'commit' });
    const progress = this.page.getByTestId('test-plan-progress');
    await expect(progress, 'the plan page shows its progress figures, not the empty or unavailable state').toBeVisible({ timeout: 30_000 });
    const chips = await this.page.locator('[data-testid^="test-plan-progress-chip-"]').allTextContents();
    return {
      percent: normalize(await this.page.getByTestId('test-plan-progress-percent').textContent() ?? ''),
      passedLabel: normalize(await this.page.getByTestId('test-plan-progress-passed').textContent() ?? ''),
      chips: chips.map(normalize),
      note: normalize(await this.page.getByTestId('test-plan-progress-note').textContent() ?? ''),
    };
  }

  private async readMilestone(args: { projectSlug: string, milestoneId: string }): Promise<MilestoneFigure> {
    await this.page.goto(this.buildUrl(`/projects/${args.projectSlug}/milestones/${args.milestoneId}`), { waitUntil: 'commit' });
    await expect(
      this.page.getByTestId('milestone-readiness'),
      'the milestone page shows its readiness, not the empty or unavailable state',
    ).toBeVisible({ timeout: 30_000 });
    const chips = await this.page.locator('[data-testid^="milestone-readiness-chip-"]').allTextContents();
    return {
      percent: normalize(await this.page.getByTestId('milestone-readiness-percent').textContent() ?? ''),
      chips: chips.map(normalize),
      note: normalize(await this.page.getByTestId('milestone-readiness-note').textContent() ?? ''),
    };
  }

  @step
  async readFigures(scope: PlanFiguresScope): Promise<PlanFiguresBaseline> {
    await this.scopeToWorkspace(scope.workspaceId);
    const openPlan = await this.readPlan({ projectSlug: scope.projectSlug, planId: scope.openPlanId });
    const milestone = await this.readMilestone({ projectSlug: scope.projectSlug, milestoneId: scope.milestoneId });
    const closedPlan = await this.readPlan({ projectSlug: scope.projectSlug, planId: scope.closedPlanId });
    return { openPlan, milestone, closedPlan };
  }

  @atc('BK-2179')
  async expectFiguresUnchangedAfterArchive(args: { baseline: PlanFiguresBaseline, scope: PlanFiguresScope }): Promise<void> {
    const after = await this.readFigures(args.scope);
    expect(after.openPlan, 'the open plan progress figures equal their baseline').toEqual(args.baseline.openPlan);
    expect(after.milestone, 'the milestone readiness figures equal their baseline').toEqual(args.baseline.milestone);
    expect(after.closedPlan, 'the closed plan frozen figures equal their baseline').toEqual(args.baseline.closedPlan);
  }
}
