import type { PlanMembership } from '@data/types';
import type { APIResponse } from '@playwright/test';
import type {
  AddPlanTestsBody,
  AddPlanTestsResponse,
  ArchiveMilestoneResponse,
  AttachPlansBody,
  AttachPlansResponse,
  ClosePlanBody,
  ClosePlanResponse,
  CreateMilestoneBody,
  CreateMilestoneResponse,
  CreatePlanBody,
  CreatePlanResponse,
  PlanMemberTestsResponse,
} from '@schemas/tests.types';
import type { TestContextOptions } from '@TestContext';

import { randomUUID } from 'node:crypto';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { step } from '@utils/decorators';

export class PlansApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  @step
  async createPlan(args: { projectId: string, name: string }): Promise<[APIResponse, CreatePlanResponse]> {
    const [response, body] = await this.apiPOST<CreatePlanResponse, CreatePlanBody>(
      `/v1/projects/${args.projectId}/test-plans`,
      { name: args.name },
    );
    expect(response.status()).toBe(201);
    return [response, body];
  }

  @step
  async addTests(args: { planId: string, testIds: string[] }): Promise<[APIResponse, AddPlanTestsResponse]> {
    const [response, body] = await this.apiPOST<AddPlanTestsResponse, AddPlanTestsBody>(
      `/v1/test-plans/${args.planId}/tests`,
      { test_ids: args.testIds },
      { headers: { 'Idempotency-Key': randomUUID() } },
    );
    expect(response.status()).toBe(201);
    return [response, body];
  }

  @step
  async listPlanMemberships(planId: string): Promise<PlanMembership[]> {
    const [response, body] = await this.apiGET<PlanMemberTestsResponse>(`/v1/test-plans/${planId}/tests`);
    expect(response.status()).toBe(200);
    return body.tests
      .map(member => ({ id: member.id, added_at: member.added_at, added_by: member.added_by }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  @step
  async closePlan(args: { planId: string, verdict: ClosePlanBody['verdict'], summary: string }): Promise<[APIResponse, ClosePlanResponse]> {
    const [response, body] = await this.apiPOST<ClosePlanResponse, ClosePlanBody>(
      `/v1/test-plans/${args.planId}/close`,
      { verdict: args.verdict, summary: args.summary },
    );
    expect(response.status()).toBe(200);
    return [response, body];
  }

  @step
  async createMilestone(args: { projectId: string, name: string, targetDate: string }): Promise<[APIResponse, CreateMilestoneResponse]> {
    const [response, body] = await this.apiPOST<CreateMilestoneResponse, CreateMilestoneBody>(
      `/v1/projects/${args.projectId}/milestones`,
      { name: args.name, target_date: args.targetDate },
    );
    expect(response.status()).toBe(201);
    return [response, body];
  }

  @step
  async attachPlans(args: { projectId: string, milestoneId: string, planIds: string[] }): Promise<[APIResponse, AttachPlansResponse]> {
    const [response, body] = await this.apiPOST<AttachPlansResponse, AttachPlansBody>(
      `/v1/projects/${args.projectId}/milestones/${args.milestoneId}/plans`,
      { test_plan_ids: args.planIds },
      { headers: { 'Idempotency-Key': randomUUID() } },
    );
    expect(response.status()).toBe(201);
    return [response, body];
  }

  @step
  async archiveMilestone(milestoneId: string): Promise<[APIResponse, ArchiveMilestoneResponse]> {
    const [response, body] = await this.apiPOST<ArchiveMilestoneResponse, Record<string, never>>(`/v1/milestones/${milestoneId}/archive`, {});
    expect(response.status()).toBe(200);
    return [response, body];
  }
}
