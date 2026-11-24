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
import type { ActivityItem, ActivityPage, ListNotificationsResponse, NotificationItem } from '@schemas/workspace.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { step } from '@utils/decorators';

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
  async listTestEvents(
    args: { workspaceId: string, action: ActivityItem['action'], testId?: string },
  ): Promise<[APIResponse, ActivityItem[]]> {
    const [response, page] = await this.listActivity(args.workspaceId);
    expect(response.status(), `GET /v1/activity for ${args.action} events`).toBe(200);
    const items = page.items.filter(item => item.action === args.action
      && (args.testId === undefined || item.item.entity_id === args.testId));
    return [response, items];
  }
}
