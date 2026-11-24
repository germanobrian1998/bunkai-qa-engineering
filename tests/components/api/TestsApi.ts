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
import { expect } from '@playwright/test';
import { atc, step } from '@utils/decorators';

export interface RenameTarget { kind: 'rename', testId: string, seedTitle: string, seedVersion: number }
export interface CreateTarget { kind: 'create', atcId: string, workspaceId: string, onCreated: (testId: string) => void }
export type TitleWriteBody = RenameTestResponse | CreateTestResponse | ErrorEnvelope;

function hasReason(details: unknown): details is { reason: string } {
  return typeof details === 'object' && details !== null && 'reason' in details && typeof details.reason === 'string';
}

function hasTest(body: unknown): body is CreateTestResponse {
  return typeof body === 'object' && body !== null && 'test' in body
    && typeof body.test === 'object' && body.test !== null && 'id' in body.test && typeof body.test.id === 'string';
}

export class TestsApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  private readReason(body: TitleWriteBody): string | null {
    return 'error' in body && hasReason(body.error.details) ? body.error.details.reason : null;
  }

  private readCode(body: TitleWriteBody): string | null {
    return 'error' in body ? body.error.code : null;
  }

  private readChanged(body: TitleWriteBody): boolean | null {
    return 'changed' in body ? body.changed : null;
  }

  private readTitleLength(body: TitleWriteBody): number | null {
    return 'test' in body ? [...body.test.title].length : null;
  }

  private async patchTitle<TBody>(args: { testId: string, title: string }): Promise<[APIResponse, TBody]> {
    const [response, body] = await this.apiPATCH<TBody, RenameTestRequest>(`/v1/tests/${args.testId}`, { title: args.title });
    return [response, body];
  }

  private async postTitle<TBody>(args: { target: CreateTarget, title: string }): Promise<[APIResponse, TBody]> {
    const { target, title } = args;
    const [response, body] = await this.apiPOST<TBody, TestCreateBody>(
      '/v1/tests',
      { title, atc_ids: [target.atcId], workspace_id: target.workspaceId },
      { headers: { 'Idempotency-Key': randomUUID() } },
    );
    if (response.ok() && hasTest(body)) {
      target.onCreated(body.test.id);
    }
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
  async archiveTest(testId: string): Promise<APIResponse> {
    const [response] = await this.apiDELETE(`/v1/tests/${testId}`);
    expect(response.status()).toBe(204);
    return response;
  }

  @step
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
      : await this.postTitle<ErrorEnvelope>({ target, title });

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
    args: { target: RenameTarget | CreateTarget, row: TitleLengthRow, title: string },
  ): Promise<[APIResponse, TitleWriteBody]> {
    const { target, row, title } = args;
    const [response, body] = target.kind === 'rename'
      ? await this.patchTitle<TitleWriteBody>({ testId: target.testId, title })
      : await this.postTitle<TitleWriteBody>({ target, title });

    expect(response.status()).toBe(row.expectedStatus);
    expect(this.readCode(body)).toBe(row.expectedCode);
    expect(this.readReason(body)).toBe(row.expectedReason);
    expect(this.readTitleLength(body)).toBe(row.expectedStatus === 422 ? null : row.count);
    if (target.kind === 'rename') {
      const [, read] = await this.getTest(target.testId);
      expect(this.readChanged(body)).toBe(row.expectedStatus === 422 ? null : true);
      expect(read.test.title).toBe(row.expectedStatus === 422 ? target.seedTitle : title);
      expect(read.test.version).toBe(row.expectedStatus === 422 ? target.seedVersion : target.seedVersion + 1);
    }
    else if (hasTest(body)) {
      const [, read] = await this.getTest(body.test.id);
      expect(read.test.title).toBe(title);
      expect([...read.test.title]).toHaveLength(row.count);
    }
    return [response, body];
  }
}
