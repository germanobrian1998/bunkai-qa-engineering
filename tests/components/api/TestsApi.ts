import type { APIResponse } from '@playwright/test';
import type {
  CreateTestResponse,
  GetTestResponse,
  RenameTestRequest,
  RenameTestResponse,
  TestCreateBody,
} from '@schemas/tests.types';
import type { ErrorEnvelope } from '@schemas/workspace.types';
import type { TestContextOptions } from '@TestContext';

import { randomUUID } from 'node:crypto';

import { ApiBase } from '@api/ApiBase';
import { TEST_LIFECYCLE } from '@data/constants';
import { DataFactory } from '@DataFactory';
import { expect } from '@playwright/test';
import { atc, step } from '@utils/decorators';

interface RenameWriter { operation: 'rename', testId: string }
interface CreateWriter { operation: 'create', atcId: string, workspaceId: string }

export type BlankTitleArgs = (RenameWriter | CreateWriter) & { title: string };

export type TitleLengthArgs = (RenameWriter | CreateWriter) & {
  character: string
  count: number
  expectedStatus: 200 | 201 | 422
};

export type TitleWriteBody = RenameTestResponse | CreateTestResponse | ErrorEnvelope;

export class TestsApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  private readReason(body: ErrorEnvelope): unknown {
    const details = body.error.details;
    return typeof details === 'object' && details !== null ? (details as { reason?: unknown }).reason : undefined;
  }

  private async writeTitle<TBody>(args: (RenameWriter | CreateWriter) & { title: string }): Promise<[APIResponse, TBody]> {
    if (args.operation === 'rename') {
      const [response, body] = await this.apiPATCH<TBody, RenameTestRequest>(`/v1/tests/${args.testId}`, { title: args.title });
      return [response, body];
    }
    const [response, body] = await this.apiPOST<TBody, TestCreateBody>(
      '/v1/tests',
      { title: args.title, atc_ids: [args.atcId], workspace_id: args.workspaceId },
      { headers: { 'Idempotency-Key': randomUUID() } },
    );
    return [response, body];
  }

  @step
  async createTest(args: { title: string, atcIds: string[], workspaceId: string }): Promise<[APIResponse, CreateTestResponse]> {
    const [response, body] = await this.apiPOST<CreateTestResponse, TestCreateBody>(
      '/v1/tests',
      { title: args.title, atc_ids: args.atcIds, workspace_id: args.workspaceId },
      { headers: { 'Idempotency-Key': randomUUID() } },
    );
    expect(response.status()).toBe(201);
    return [response, body];
  }

  @step
  async getTest(testId: string): Promise<[APIResponse, GetTestResponse]> {
    const [response, body] = await this.apiGET<GetTestResponse>(`/v1/tests/${testId}`);
    expect(response.status()).toBe(200);
    return [response, body];
  }

  @step
  async renameTest(args: { testId: string, title: string }): Promise<[APIResponse, RenameTestResponse]> {
    const [response, body] = await this.apiPATCH<RenameTestResponse, RenameTestRequest>(
      `/v1/tests/${args.testId}`,
      { title: args.title },
    );
    expect(response.status()).toBe(200);
    return [response, body];
  }

  @step
  async archiveTest(testId: string): Promise<APIResponse> {
    const [response] = await this.apiDELETE(`/v1/tests/${testId}`);
    expect(response.status()).toBe(204);
    return response;
  }

  @atc('BK-2156')
  async refuseBlankTitle(args: BlankTitleArgs): Promise<[APIResponse, ErrorEnvelope]> {
    const [response, body] = await this.writeTitle<ErrorEnvelope>(args);

    expect(response.status()).toBe(422);
    expect(body.error.code).toBe('validation_failed');
    expect(this.readReason(body)).toBe(TEST_LIFECYCLE.titleRequiredReason);
    return [response, body];
  }

  @atc('BK-2167')
  async applyTitleLengthRule(args: TitleLengthArgs): Promise<[APIResponse, TitleWriteBody]> {
    const title = DataFactory.createTitleOfLength({ character: args.character, count: args.count });
    const [response, body] = await this.writeTitle<TitleWriteBody>({ ...args, title });

    expect(response.status()).toBe(args.expectedStatus);
    if (args.expectedStatus === 422) {
      const error = body as ErrorEnvelope;
      expect(error.error.code).toBe('validation_failed');
      expect(this.readReason(error)).toBe(TEST_LIFECYCLE.titleTooLongReason);
    }
    else {
      expect([...(body as RenameTestResponse | CreateTestResponse).test.title]).toHaveLength(args.count);
    }
    return [response, body];
  }
}
