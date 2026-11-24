import type { FrozenWriteRow, NonMemberRow, TitleLengthRow, ViewerWriteRow } from '@data/constants';
import type { APIResponse } from '@playwright/test';
import type {
  CreateTestResponse,
  GetTestResponse,
  RenameTestRequest,
  RenameTestResponse,
  SearchPageResponse,
  SearchTestsResponse,
  TestCreateBody,
  TestReorderBody,
  TestTagsBody,
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
export interface CreateTarget { kind: 'create', atcId: string, workspaceId: string, onCreated: (testId: string) => void }
export type TitleWriteBody = RenameTestResponse | CreateTestResponse | ErrorEnvelope;

function hasReason(details: unknown): details is { reason: string } {
  return typeof details === 'object' && details !== null && 'reason' in details && typeof details.reason === 'string';
}

function hasTest(body: unknown): body is CreateTestResponse {
  return typeof body === 'object' && body !== null && 'test' in body
    && typeof body.test === 'object' && body.test !== null && 'id' in body.test && typeof body.test.id === 'string';
}

function hasCurrentVersion(details: unknown): details is { current_version: number } {
  return typeof details === 'object' && details !== null && 'current_version' in details && typeof details.current_version === 'number';
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

  private readCurrentVersion(body: ErrorEnvelope): number | null {
    return hasCurrentVersion(body.error.details) ? body.error.details.current_version : null;
  }

  private withoutRequestId(body: ErrorEnvelope): Pick<ErrorEnvelope['error'], 'code' | 'message' | 'details'> {
    return { code: body.error.code, message: body.error.message, details: body.error.details };
  }

  private async sendFrozenWrite(args: { testId: string, row: FrozenWriteRow, stepIds: string[] }): Promise<[APIResponse, ErrorEnvelope]> {
    const { testId, row, stepIds } = args;
    switch (row.kind) {
      case 'rename': {
        const [response, body] = await this.patchTitle<ErrorEnvelope>({ testId, title: DataFactory.createTestTitle() });
        return [response, body];
      }
      case 'reorder': {
        const [response, body] = await this.apiPATCH<ErrorEnvelope, TestReorderBody>(
          `/v1/tests/${testId}/reorder`,
          { step_ids: [...stepIds].reverse() },
        );
        return [response, body];
      }
      case 'tags': {
        const [response, body] = await this.apiPUT<ErrorEnvelope, TestTagsBody>(
          `/v1/tests/${testId}/tags`,
          { tags: [...TEST_LIFECYCLE.frozenTags] },
        );
        return [response, body];
      }
    }
  }

  private async sendViewerWrite(args: { testId: string, row: ViewerWriteRow }): Promise<[APIResponse, ErrorEnvelope]> {
    const { testId, row } = args;
    switch (row.action) {
      case 'rename': {
        const [response, body] = await this.patchTitle<ErrorEnvelope>({ testId, title: DataFactory.createTestTitle() });
        return [response, body];
      }
      case 'archive': {
        const [response, body] = await this.apiDELETE<ErrorEnvelope>(`/v1/tests/${testId}`);
        return [response, body];
      }
      case 'restore': {
        const [response, body] = await this.apiPOST<ErrorEnvelope, Record<string, never>>(`/v1/tests/${testId}/restore`, {});
        return [response, body];
      }
    }
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
  async searchTests(args: { title: string, projectId: string }): Promise<[APIResponse, SearchTestsResponse]> {
    const [response, body] = await this.apiGET<SearchTestsResponse>('/v1/tests/search', {
      params: { query: args.title, project_id: args.projectId },
    });
    expect(response.status()).toBe(200);
    return [response, body];
  }

  @step
  async searchPalette(query: string): Promise<[APIResponse, SearchPageResponse]> {
    const [response, body] = await this.apiGET<SearchPageResponse>('/v1/search', { params: { q: query } });
    expect(response.status()).toBe(200);
    return [response, body];
  }

  @step
  async setTags(args: { testId: string, tags: string[] }): Promise<APIResponse> {
    const [response] = await this.apiPUT<unknown, TestTagsBody>(`/v1/tests/${args.testId}/tags`, { tags: args.tags });
    expect(response.status()).toBe(200);
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

  @atc('BK-2161')
  async refuseWriteOnArchivedTest(
    args: { testId: string, row: FrozenWriteRow, stepIds: string[] },
  ): Promise<[APIResponse, ErrorEnvelope]> {
    const [response, body] = await this.sendFrozenWrite(args);
    expect(response.status()).toBe(args.row.expectedStatus);
    expect(body.error.code).toBe(args.row.expectedCode);
    expect(this.readReason(body)).toBe(args.row.expectedReason);
    return [response, body];
  }

  @atc('BK-2163')
  async refuseWriteByViewer(args: { testId: string, row: ViewerWriteRow }): Promise<[APIResponse, ErrorEnvelope]> {
    const [response, body] = await this.sendViewerWrite(args);
    expect(response.status()).toBe(args.row.expectedStatus);
    expect(body.error.code).toBe(args.row.expectedCode);
    return [response, body];
  }

  @atc('BK-2164')
  async hideTestFromNonMember(
    args: { testId: string, title: string, projectId: string, row: NonMemberRow },
  ): Promise<[APIResponse, ErrorEnvelope]> {
    const { row } = args;
    const [response, body] = await this.apiGET<ErrorEnvelope>(`/v1/tests/${args.testId}`);
    expect(response.status()).toBe(row.expectedStatus);
    expect(body.error.code).toBe(row.expectedCode);

    const [missing, missingBody] = await this.apiGET<ErrorEnvelope>(`/v1/tests/${randomUUID()}`);
    expect(missing.status()).toBe(row.expectedStatus);
    expect(this.withoutRequestId(body)).toEqual(this.withoutRequestId(missingBody));

    const [, search] = await this.searchTests({ title: args.title, projectId: args.projectId });
    expect(search.items).toEqual([]);

    const [, palette] = await this.searchPalette(args.title);
    expect(palette.data.filter(item => item.id === args.testId)).toEqual([]);
    return [response, body];
  }

  @atc('BK-2165')
  async refuseStaleVersionRename(args: { testId: string, staleVersion: number }): Promise<[APIResponse, ErrorEnvelope]> {
    const [response, body] = await this.apiPATCH<ErrorEnvelope, RenameTestRequest>(
      `/v1/tests/${args.testId}`,
      { title: DataFactory.createTestTitle() },
      { headers: { 'X-If-Match': String(args.staleVersion) } },
    );
    expect(response.status()).toBe(409);
    expect(body.error.code).toBe('conflict');
    expect(this.readReason(body)).toBe(TEST_LIFECYCLE.versionConflictReason);
    expect(this.readCurrentVersion(body)).toBe(args.staleVersion + 1);
    return [response, body];
  }
}
