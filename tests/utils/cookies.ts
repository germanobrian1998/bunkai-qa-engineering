import type { Cookie } from '@playwright/test';

export function activeWorkspaceCookie(args: { name: string, workspaceId: string, hostUrl: string }): Cookie {
  const host = new URL(args.hostUrl);
  return {
    name: args.name,
    value: args.workspaceId,
    domain: host.hostname,
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: host.protocol === 'https:',
    sameSite: 'Lax',
  };
}
