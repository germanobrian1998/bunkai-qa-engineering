import type { Cookie } from '@playwright/test';

import { ACTIVE_WORKSPACE_COOKIE } from '@data/constants';

export function activeWorkspaceCookie(args: { workspaceId: string, hostUrl: string }): Cookie {
  const host = new URL(args.hostUrl);
  return {
    name: ACTIVE_WORKSPACE_COOKIE,
    value: args.workspaceId,
    domain: host.hostname,
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: host.protocol === 'https:',
    sameSite: 'Lax',
  };
}
