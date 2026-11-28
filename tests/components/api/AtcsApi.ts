import type { APIResponse } from '@playwright/test';
import type { AtcUsageReport, CreateAtcRequest, CreateAtcResponse, SearchAtcsResponse } from '@schemas/tests.types';
import type { TestContextOptions } from '@TestContext';

import { randomUUID } from 'node:crypto';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { step } from '@utils/decorators';

export class AtcsApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  @step
  async createAtc(payload: CreateAtcRequest): Promise<[APIResponse, CreateAtcResponse]> {
    const [response, body] = await this.apiPOST<CreateAtcResponse, CreateAtcRequest>(
      '/v1/atcs',
      payload,
      { headers: { 'Idempotency-Key': randomUUID() } },
    );
    expect(response.status()).toBe(201);
    return [response, body];
  }

  @step
  async searchAtcs(args: { projectId: string, query: string }): Promise<[APIResponse, SearchAtcsResponse]> {
    const [response, body] = await this.apiGET<SearchAtcsResponse>('/v1/atcs/search', {
      params: { project_id: args.projectId, query: args.query, limit: '50' },
    });
    return [response, body];
  }

  @step
  async readAtcUsage(atcId: string): Promise<[APIResponse, AtcUsageReport]> {
    const [response, body] = await this.apiGET<AtcUsageReport>(`/v1/atcs/${atcId}/usage`);
    expect(response.status()).toBe(200);
    return [response, body];
  }
}
