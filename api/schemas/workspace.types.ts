/**
 * KATA Framework - Type Facade: Workspace Domain
 *
 * Workspaces, invites, membership and the shared error envelope of the
 * Bunkai API. Every type is derived from api/openapi-types.ts.
 *
 * Consumed by: tests/components/api/ (workspace components)
 */

import type { components, paths } from '@openapi';

// ============================================================================
// Schema Types (from components.schemas)
// ============================================================================

/** Shared error envelope returned by every 4xx/5xx response */
export type ErrorEnvelope = components['schemas']['ErrorEnvelope'];
export type ErrorCode = ErrorEnvelope['error']['code'];

export type Workspace = components['schemas']['Workspace'];
export type WorkspaceWithRole = components['schemas']['WorkspaceWithRole'];
export type WorkspaceInvite = components['schemas']['WorkspaceInvite'];

// ============================================================================
// GET /api/v1/workspaces
// ============================================================================

type ListWorkspacesPath = paths['/api/v1/workspaces']['get'];

/** Successful response (200) */
export type ListWorkspacesResponse = ListWorkspacesPath['responses']['200']['content']['application/json'];

// ============================================================================
// POST /api/v1/workspaces
// ============================================================================

type CreateWorkspacePath = paths['/api/v1/workspaces']['post'];

export type CreateWorkspaceRequest = CreateWorkspacePath['requestBody']['content']['application/json'];

/** Successful response (201) */
export type CreateWorkspaceResponse = CreateWorkspacePath['responses']['201']['content']['application/json'];

// ============================================================================
// GET /api/v1/workspaces/{id}
// ============================================================================

type GetWorkspacePath = paths['/api/v1/workspaces/{id}']['get'];

export type WorkspaceParams = GetWorkspacePath['parameters']['path'];

/** Successful response (200) */
export type GetWorkspaceResponse = GetWorkspacePath['responses']['200']['content']['application/json'];

// ============================================================================
// PATCH /api/v1/workspaces/{id}
// ============================================================================

type UpdateWorkspacePath = paths['/api/v1/workspaces/{id}']['patch'];

export type UpdateWorkspaceRequest = UpdateWorkspacePath['requestBody']['content']['application/json'];

/** Successful response (200) */
export type UpdateWorkspaceResponse = UpdateWorkspacePath['responses']['200']['content']['application/json'];

// ============================================================================
// DELETE /api/v1/workspaces/{id}
// ============================================================================

type DeleteWorkspacePath = paths['/api/v1/workspaces/{id}']['delete'];

/** Successful response (200) */
export type DeleteWorkspaceResponse = DeleteWorkspacePath['responses']['200']['content']['application/json'];

// ============================================================================
// POST /api/v1/workspaces/{id}/restore
// ============================================================================

type RestoreWorkspacePath = paths['/api/v1/workspaces/{id}/restore']['post'];

/** Successful response (200) */
export type RestoreWorkspaceResponse = RestoreWorkspacePath['responses']['200']['content']['application/json'];

// ============================================================================
// GET /api/v1/workspaces/{id}/invites
// ============================================================================

type ListInvitesPath = paths['/api/v1/workspaces/{id}/invites']['get'];

/** Successful response (200) */
export type ListInvitesResponse = ListInvitesPath['responses']['200']['content']['application/json'];

// ============================================================================
// POST /api/v1/workspaces/{id}/invites
// ============================================================================

type CreateInvitePath = paths['/api/v1/workspaces/{id}/invites']['post'];

export type CreateInviteRequest = CreateInvitePath['requestBody']['content']['application/json'];

/** Successful response (201) */
export type CreateInviteResponse = CreateInvitePath['responses']['201']['content']['application/json'];

// ============================================================================
// POST /api/v1/workspaces/{id}/invites/{inviteId} (resend)
// ============================================================================

type ResendInvitePath = paths['/api/v1/workspaces/{id}/invites/{inviteId}']['post'];

export type InviteParams = ResendInvitePath['parameters']['path'];

/** Successful response (200) */
export type ResendInviteResponse = ResendInvitePath['responses']['200']['content']['application/json'];

// ============================================================================
// DELETE /api/v1/workspaces/{id}/invites/{inviteId} (revoke)
// ============================================================================

type RevokeInvitePath = paths['/api/v1/workspaces/{id}/invites/{inviteId}']['delete'];

/** Successful response (200) */
export type RevokeInviteResponse = RevokeInvitePath['responses']['200']['content']['application/json'];

// ============================================================================
// POST /api/v1/invites/accept
// ============================================================================

type AcceptInvitePath = paths['/api/v1/invites/accept']['post'];

export type AcceptInviteRequest = AcceptInvitePath['requestBody']['content']['application/json'];

/** Successful response (200) */
export type AcceptInviteResponse = AcceptInvitePath['responses']['200']['content']['application/json'];

// ============================================================================
// DELETE /api/v1/workspaces/{id}/members/{userId}
// ============================================================================

type RemoveMemberPath = paths['/api/v1/workspaces/{id}/members/{userId}']['delete'];

export type RemoveMemberParams = RemoveMemberPath['parameters']['path'];

/** Successful response (200) */
export type RemoveMemberResponse = RemoveMemberPath['responses']['200']['content']['application/json'];

// ============================================================================
// DELETE /api/v1/workspaces/{id}/membership (self-leave)
// ============================================================================

type LeaveWorkspacePath = paths['/api/v1/workspaces/{id}/membership']['delete'];

/** Successful response (200) */
export type LeaveWorkspaceResponse = LeaveWorkspacePath['responses']['200']['content']['application/json'];

// ============================================================================
// Member removal (BK-572): roster, tokens, bugs, activity, notifications
// ============================================================================

/** A member as listed by the chat roster (the members list with emails) */
export type ChatMember = components['schemas']['ChatMember'];

/** Successful response (200) of GET /api/v1/workspaces/{id}/chat/roster */
export type ListMembersResponse = paths['/api/v1/workspaces/{id}/chat/roster']['get']['responses']['200']['content']['application/json'];

/** Body of the 200 answered by DELETE /api/v1/workspaces/{id}/members/{userId} */
export type WorkspaceMemberRemoveResponse = components['schemas']['WorkspaceMemberRemoveResponse'];

/** Request and response of POST /api/v1/tokens */
export type CreateTokenBody = components['schemas']['CreateTokenBody'];
export type CreateTokenResponse = components['schemas']['CreateTokenResponse'];

/** A workspace project as listed by GET /api/v1/workspaces/{id}/recent-projects */
export type ListProjectsResponse = paths['/api/v1/workspaces/{id}/recent-projects']['get']['responses']['200']['content']['application/json'];

/** Projects of a workspace filtered by exact slug (GET /api/v1/workspaces/{id}/projects) */
export type ListProjectsBySlugResponse = paths['/api/v1/workspaces/{id}/projects']['get']['responses']['200']['content']['application/json'];

/** Modules of a project (GET /api/v1/projects/{id}/modules) */
export type ListModulesResponse = paths['/api/v1/projects/{id}/modules']['get']['responses']['200']['content']['application/json'];

/** Bugs of a project (GET /api/v1/projects/{id}/bugs) */
export type ListProjectBugsResponse = paths['/api/v1/projects/{id}/bugs']['get']['responses']['200']['content']['application/json'];

/** Bug read model returned by GET /api/v1/bugs/{id} and the assign route */
export type BugDetail = components['schemas']['BugDetail'];
export type BugAssignBody = components['schemas']['BugAssignBody'];

/** Standalone bug creation (POST /api/v1/bugs, module form) */
export type CreateBugRequest = paths['/api/v1/bugs']['post']['requestBody']['content']['application/json'];
export type CreateBugResponse = paths['/api/v1/bugs']['post']['responses']['201']['content']['application/json'];

/** Activity feed page and the two member-removal related items */
export type ActivityPage = components['schemas']['ActivityPage'];
export type ActivityItem = components['schemas']['ActivityItem'];
export type ActivityItemMemberRemoved = components['schemas']['ActivityItemMemberRemoved'];
export type ActivityItemBugUnassigned = components['schemas']['ActivityItemBugUnassigned'];

/** Successful response (200) of GET /api/v1/workspaces/{id}/notifications */
export type ListNotificationsResponse = paths['/api/v1/workspaces/{id}/notifications']['get']['responses']['200']['content']['application/json'];

/** Token list of the caller (GET /api/v1/tokens) and one entry */
export type ListTokensResponse = components['schemas']['ListTokensResponse'];
export type TokenSummary = components['schemas']['TokenSummary'];

/** A notification as listed by GET /api/v1/workspaces/{id}/notifications */
export type NotificationItem = components['schemas']['NotificationItem'];
