import type { APIResponse } from '@playwright/test';
import type { CreateAtcRequest, CreateAtcResponse } from '@schemas/tests.types';
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
}
