import type { APIResponse } from '@playwright/test';
import type {
  CreateAcceptanceCriterionBody,
  CreateAcceptanceCriterionResponse,
  CreateModuleBody,
  CreateModuleResponse,
  CreateUserStoryBody,
  CreateUserStoryResponse,
} from '@schemas/tests.types';
import type { TestContextOptions } from '@TestContext';

import { randomUUID } from 'node:crypto';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { step } from '@utils/decorators';

export class StructureApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  @step
  async createModule(args: { projectId: string, name: string }): Promise<[APIResponse, CreateModuleResponse]> {
    const [response, body] = await this.apiPOST<CreateModuleResponse, CreateModuleBody>(
      `/v1/projects/${args.projectId}/modules`,
      { name: args.name },
    );
    expect(response.status()).toBe(201);
    return [response, body];
  }

  @step
  async createUserStory(args: { moduleId: string, title: string }): Promise<[APIResponse, CreateUserStoryResponse]> {
    const [response, body] = await this.apiPOST<CreateUserStoryResponse, CreateUserStoryBody>(
      `/v1/modules/${args.moduleId}/user-stories`,
      { title: args.title },
      { headers: { 'Idempotency-Key': randomUUID() } },
    );
    expect(response.status()).toBe(201);
    return [response, body];
  }

  @step
  async createAcceptanceCriterion(
    args: { userStoryId: string, title: string },
  ): Promise<[APIResponse, CreateAcceptanceCriterionResponse]> {
    const [response, body] = await this.apiPOST<CreateAcceptanceCriterionResponse, CreateAcceptanceCriterionBody>(
      `/v1/user-stories/${args.userStoryId}/acceptance-criteria`,
      { title: args.title },
    );
    expect(response.status()).toBe(201);
    return [response, body];
  }
}
