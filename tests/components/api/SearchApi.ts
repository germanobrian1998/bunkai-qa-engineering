import type { APIResponse } from '@playwright/test';
import type { SearchPageResponse } from '@schemas/tests.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { step } from '@utils/decorators';

export class SearchApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  @step
  async searchPalette(query: string): Promise<[APIResponse, SearchPageResponse]> {
    const [response, body] = await this.apiGET<SearchPageResponse>('/v1/search', { params: { q: query } });
    expect(response.status()).toBe(200);
    return [response, body];
  }
}
