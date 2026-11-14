/**
 * KATA Architecture - Role Sessions Setup (Project)
 *
 * Signs in each workspace role ONCE per run (Owner, Admin, Member, Viewer) and
 * writes a cookie storageState per role plus the role's Supabase access token.
 * Specs open callers with `request.newContext({ storageState })`.
 *
 * Throttle: signin allows 10/60 s per source and 10/15 min per account, so each
 * role signs in exactly once, sequentially.
 *
 * Dependencies: global-setup
 * Dependents: none by default (specs that need role sessions declare it)
 */

import { writeFileSync } from 'node:fs';
import { AuthApi } from '@api/AuthApi';
import { request as playwrightRequest, test as setup } from '@playwright/test';
import { config, workspaceRoles } from '@variables';

setup('Role Sessions Setup: sign in every role once', async () => {
  for (const role of workspaceRoles) {
    // Fails fast naming the missing variables before any request is sent
    const credentials = config.roleUser(role);

    const context = await playwrightRequest.newContext();
    try {
      const auth = new AuthApi({ request: context });
      const [, body] = await auth.signInForSession(credentials);

      await context.storageState({ path: config.auth.roleStatePath(role) });
      writeFileSync(
        config.auth.roleTokenPath(role),
        JSON.stringify({ accessToken: body.session.access_token }),
      );
      console.log(`[Role Sessions] ${role}: session saved`);
    }
    finally {
      await context.dispose();
    }
  }
});
