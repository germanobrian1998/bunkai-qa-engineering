/**
 * KATA Architecture - Workspace Smoke Integration Tests
 *
 * Story BK-4 (Workspace, GET /workspaces/{id}). Reads only: no shared data is mutated.
 *
 * Project: integration (depends on api-setup)
 */

import { expect, test } from '@TestFixture';

test.describe('BK-4: Workspace read API', () => {
  test('BK-4: should read the active workspace and list it', { tag: ['@critical'] }, async ({ api }) => {
    const [meResponse, me] = await api.auth.getCurrentUser();
    expect(meResponse.status()).toBe(200);

    const workspaceId = me.active_workspace_id ?? me.workspaces[0]?.id;
    expect(workspaceId).toBeDefined();

    const [getResponse, getBody] = await api.workspace.getWorkspace(workspaceId);
    expect(getResponse.status()).toBe(200);
    expect(getBody.workspace.id).toBe(workspaceId);

    const [listResponse, listBody] = await api.workspace.listWorkspaces();
    expect(listResponse.status()).toBe(200);
    expect(listBody.workspaces.map(workspace => workspace.id)).toContain(workspaceId);
  });
});
