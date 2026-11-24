import type { APIResponse } from '@playwright/test';
import type {
  AddPlanTestsBody,
  AddPlanTestsResponse,
  CreatePlanBody,
  CreatePlanResponse,
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
}
