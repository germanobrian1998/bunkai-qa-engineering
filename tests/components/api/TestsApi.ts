import type { TitleLengthRow } from '@data/constants';
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

export interface RenameTarget { kind: 'rename', testId: string, seedTitle: string, seedVersion: number }
export interface CreateTarget { kind: 'create', atcId: string, workspaceId: string }
export type TitleWriteBody = RenameTestResponse | CreateTestResponse | ErrorEnvelope;

function hasReason(details: unknown): details is { reason: string } {
  return typeof details === 'object' && details !== null && 'reason' in details && typeof details.reason === 'string';
}

export class TestsApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  private readReason(body: TitleWriteBody): string | null {
    return 'error' in body && hasReason(body.error.details) ? body.error.details.reason : null;
  }

  private readTitleLength(body: TitleWriteBody): number | null {
    return 'test' in body ? [...body.test.title].length : null;
  }

  private async patchTitle<TBody>(args: { testId: string, title: string }): Promise<[APIResponse, TBody]> {
    const [response, body] = await this.apiPATCH<TBody, RenameTestRequest>(`/v1/tests/${args.testId}`, { title: args.title });
    return [response, body];
  }

  private async postTitle<TBody>(args: { atcId: string, workspaceId: string, title: string }): Promise<[APIResponse, TBody]> {
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

  private async expectSeedUntouched(target: RenameTarget): Promise<void> {
    const [, read] = await this.getTest(target.testId);
    expect(read.test.title).toBe(target.seedTitle);
    expect(read.test.version).toBe(target.seedVersion);
  }

  @atc('BK-2156')
  async refuseBlankTitle(args: { target: RenameTarget | CreateTarget, title: string }): Promise<[APIResponse, ErrorEnvelope]> {
    const { target, title } = args;
    const [response, body] = target.kind === 'rename'
      ? await this.patchTitle<ErrorEnvelope>({ testId: target.testId, title })
      : await this.postTitle<ErrorEnvelope>({ atcId: target.atcId, workspaceId: target.workspaceId, title });

    expect(response.status()).toBe(422);
    expect(body.error.code).toBe('validation_failed');
    expect(this.readReason(body)).toBe(TEST_LIFECYCLE.titleRequiredReason);
    if (target.kind === 'rename') {
      await this.expectSeedUntouched(target);
    }
    return [response, body];
  }

  @atc('BK-2167')
  async applyTitleLengthBoundaries(
    args: { target: RenameTarget | CreateTarget, row: TitleLengthRow },
  ): Promise<[APIResponse, TitleWriteBody]> {
    const { target, row } = args;
    const title = DataFactory.createTitleOfLength(row);
    const [response, body] = target.kind === 'rename'
      ? await this.patchTitle<TitleWriteBody>({ testId: target.testId, title })
      : await this.postTitle<TitleWriteBody>({ atcId: target.atcId, workspaceId: target.workspaceId, title });

    expect(target.kind).toBe(row.endpoint);
    expect(response.status()).toBe(row.expectedStatus);
    expect(this.readReason(body)).toBe(row.expectedReason);
    expect(this.readTitleLength(body)).toBe(row.expectedStatus === 422 ? null : row.count);
    if (target.kind === 'rename') {
      const [, read] = await this.getTest(target.testId);
      expect(read.test.title).toBe(row.expectedStatus === 422 ? target.seedTitle : title);
    }
    return [response, body];
  }
}
