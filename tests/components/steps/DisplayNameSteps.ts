import type { APIRequestContext, Page, PlaywrightWorkerArgs } from '@playwright/test';
import type { CreateTokenResponse } from '@schemas/workspace.types';
import type { WorkspaceRole } from '@variables';

import { ApiFixture } from '@ApiFixture';
import { TestContext } from '@TestContext';
import { config } from '@variables';

export interface DisplayNameSession {
  api: ApiFixture
}

interface Captured {
  api: ApiFixture
  original: string | null
}

const FIXTURE_TOKEN_NAME = 'kata-bk1949-fixture';
const FACTORY_NAME_SHAPE = /^Kata /;

export class DisplayNameSteps extends TestContext {
  private readonly playwright: PlaywrightWorkerArgs['playwright'];
  private readonly contexts: APIRequestContext[] = [];
  private readonly captured: Captured[] = [];
  private readonly mintedPats: { api: ApiFixture, id: string }[] = [];

  constructor(args: { playwright: PlaywrightWorkerArgs['playwright'] }) {
    super();
    this.playwright = args.playwright;
  }

  private async openContext(storageState?: string): Promise<APIRequestContext> {
    const request = await this.playwright.request.newContext(storageState ? { storageState } : {});
    this.contexts.push(request);
    return request;
  }

  async openRoleSession(role: WorkspaceRole): Promise<DisplayNameSession> {
    const request = await this.openContext(config.auth.roleStatePath(role));
    return { api: new ApiFixture({ request }) };
  }

  async openOwnerBrowserSession(): Promise<DisplayNameSession> {
    const request = await this.openContext(config.auth.storageStatePath);
    return { api: new ApiFixture({ request }) };
  }

  async openAnonymous(): Promise<DisplayNameSession> {
    const request = await this.openContext();
    return { api: new ApiFixture({ request }) };
  }

  async openBearerOnly(token: string): Promise<DisplayNameSession> {
    const request = await this.openContext();
    const api = new ApiFixture({ request });
    api.setAuthToken(token);
    return { api };
  }

  async openCookieWithBearer(args: { role: WorkspaceRole, token: string }): Promise<DisplayNameSession> {
    const session = await this.openRoleSession(args.role);
    session.api.setAuthToken(args.token);
    return session;
  }

  forBrowser(page: Page): ApiFixture {
    return new ApiFixture({ page });
  }

  async capture(api: ApiFixture): Promise<string | null> {
    const stored = await api.displayName.readStoredName();
    const original = stored !== null && FACTORY_NAME_SHAPE.test(stored) ? null : stored;
    this.captured.push({ api, original });
    return original;
  }

  async mintPat(issuer: DisplayNameSession): Promise<CreateTokenResponse> {
    const [, token] = await issuer.api.auth.provisionToken({
      scopes: ['atc:read', 'atc:write', 'run:execute'],
      expiresInDays: 1,
      name: FIXTURE_TOKEN_NAME,
    });
    this.mintedPats.push({ api: issuer.api, id: token.id });
    return token;
  }

  async release(): Promise<void> {
    const errors: unknown[] = [];
    const attempt = async (action: () => Promise<unknown>) => {
      try {
        await action();
      }
      catch (error) {
        errors.push(error);
      }
    };

    for (const { api, original } of this.captured) {
      await attempt(async () => (original === null ? api.displayName.removeName() : api.displayName.saveName(original)));
    }
    for (const { api, id } of this.mintedPats) {
      await attempt(async () => api.auth.revokeToken(id));
    }
    for (const context of this.contexts) {
      await attempt(async () => context.dispose());
    }
    if (errors.length === 0) {
      return;
    }
    throw new AggregateError(errors, 'display name cleanup failed');
  }
}
