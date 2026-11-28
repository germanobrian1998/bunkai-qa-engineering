import type { APIResponse } from '@playwright/test';
import type { SearchPageResponse } from '@schemas/tests.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { step } from '@utils/decorators';

export interface ChatEntitySearchResponse { items: { id: string, type: string }[] }

function isChatEntitySearch(body: unknown): body is ChatEntitySearchResponse {
  return typeof body === 'object' && body !== null && 'items' in body && Array.isArray(body.items)
    && body.items.every(item => typeof item === 'object' && item !== null
      && 'id' in item && typeof item.id === 'string' && 'type' in item && typeof item.type === 'string');
}

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

  @step
  async searchChatEntities(args: { workspaceId: string, query: string }): Promise<[APIResponse, ChatEntitySearchResponse]> {
    const [response, body] = await this.apiGET<ChatEntitySearchResponse>(
      `/v1/workspaces/${args.workspaceId}/chat/entities/search`,
      { params: { q: args.query } },
    );
    expect(response.status()).toBe(200);
    if (!isChatEntitySearch(body)) {
      throw new Error('contract drift: the chat entity search no longer answers { items: [{ id, type }] }');
    }
    return [response, body];
  }
}
