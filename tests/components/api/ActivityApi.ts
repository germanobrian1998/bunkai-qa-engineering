/**
 * KATA Architecture - Layer 3: Activity API Component
 *
 * Read-only component for the activity feed and the notifications inbox.
 * Tests take a baseline before an action and compare the delta afterwards
 * (the API proxy of the "no notification row" database checks).
 *
 * Endpoints (relative to config.apiUrl):
 * - GET /v1/activity?workspace_id= - Activity feed, newest first (max 50 per page)
 * - GET /v1/workspaces/{id}/notifications - The caller's inbox in a workspace
 */

import type { APIResponse } from '@playwright/test';
import type { GetTestResponse } from '@schemas/tests.types';
import type { ActivityItem, ActivityPage, ListNotificationsResponse, NotificationItem } from '@schemas/workspace.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { step } from '@utils/decorators';

const ACTIVITY_PAGE_CAP = 20;

// ============================================
// Activity API Component
// ============================================

export class ActivityApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers - Read-only operations (no @atc)
  // ============================================

  /**
   * Helper: Read the newest page (50 items) of a workspace's activity feed.
   *
   * @param workspaceId - Workspace UUID
   * @returns Tuple with response and activity page
   */
  @step
  async listActivity(workspaceId: string): Promise<[APIResponse, ActivityPage]> {
    const [response, body] = await this.apiGET<ActivityPage>('/v1/activity', {
      params: { workspace_id: workspaceId, limit: '50' },
    });
    return [response, body];
  }

  /**
   * Helper: Read the caller's notification inbox in a workspace.
   *
   * @param workspaceId - Workspace UUID
   * @returns Tuple with response and inbox body
   */
  @step
  async listNotifications(workspaceId: string): Promise<[APIResponse, ListNotificationsResponse]> {
    const [response, body] = await this.apiGET<ListNotificationsResponse>(`/v1/workspaces/${workspaceId}/notifications`, {
      params: { limit: '50' },
    });
    return [response, body];
  }

  /**
   * Helper: Read the caller's inbox and report what is new against a baseline:
   * the items whose id was not in the baseline, and the current unread count.
   * Comparing ids (not page lengths) stays correct when the page is capped.
   *
   * @param args - Workspace and the item ids of the baseline inbox
   * @returns Tuple with response, new items and unread count
   */
  @step
  async listNewNotifications(
    args: { workspaceId: string, knownIds: string[] },
  ): Promise<[APIResponse, { newItems: NotificationItem[], unreadCount: number }]> {
    const [response, body] = await this.listNotifications(args.workspaceId);
    const newItems = body.items.filter(item => !args.knownIds.includes(item.id));
    return [response, { newItems, unreadCount: body.unread_count }];
  }

  @step
  async snapshotTestEvents(
    args: { workspaceId: string, actions: ActivityItem['action'][], testId?: string },
  ): Promise<string[]> {
    const items = await this.collectTestActivity(args);
    return items.map(item => item.id);
  }

  private async collectTestActivity(
    args: { workspaceId: string, actions: ActivityItem['action'][], testId?: string },
  ): Promise<ActivityItem[]> {
    const { workspaceId, actions, testId } = args;
    const items: ActivityItem[] = [];
    const floor = testId === undefined ? null : await this.readTestCreatedAt(testId);
    let cursor: string | null = null;
    for (let pageNumber = 0; pageNumber < ACTIVITY_PAGE_CAP; pageNumber++) {
      const params: Record<string, string> = cursor === null
        ? { workspace_id: workspaceId, limit: '50' }
        : { workspace_id: workspaceId, limit: '50', cursor };
      const [response, page] = await this.apiGET<ActivityPage>('/v1/activity', { params });
      expect(response.status(), `GET /v1/activity for ${actions.join(', ')} events`).toBe(200);
      items.push(...page.items
        .filter(item => actions.includes(item.action) && (testId === undefined || item.item.entity_id === testId)));
      cursor = page.next_cursor;
      const oldest = page.items.at(-1);
      const coveredFloor = floor !== null && oldest !== undefined && Date.parse(oldest.created_at) < Date.parse(floor);
      if (cursor === null || floor === null || coveredFloor) {
        return items;
      }
    }
    throw new Error(`GET /v1/activity: the events of Test ${testId} were not covered within ${ACTIVITY_PAGE_CAP} pages`);
  }

  private async readTestCreatedAt(testId: string): Promise<string> {
    const [response, body] = await this.apiGET<GetTestResponse>(`/v1/tests/${testId}`);
    expect(response.status(), `GET /v1/tests/${testId} for its creation time`).toBe(200);
    return body.test.created_at;
  }

  @step
  async listNewTestEvents(
    args: { workspaceId: string, actions: ActivityItem['action'][], testId?: string, knownIds: string[] },
  ): Promise<string[]> {
    const items = await this.listNewTestActivity(args);
    return items.map(item => item.id);
  }

  @step
  async listNewTestActivity(
    args: { workspaceId: string, actions: ActivityItem['action'][], testId?: string, knownIds: string[] },
  ): Promise<ActivityItem[]> {
    const items = await this.collectTestActivity(args);
    return items.filter(item => !args.knownIds.includes(item.id));
  }
}
