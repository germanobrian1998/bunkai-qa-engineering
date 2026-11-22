import type { APIResponse } from '@playwright/test';
import type { DisplayNameBody, DisplayNameResponse } from '@schemas/account.types';
import type { MeResponse } from '@schemas/auth.types';
import type { ErrorEnvelope } from '@schemas/workspace.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { DISPLAY_NAME_MESSAGES } from '@data/constants';
import { expect } from '@playwright/test';
import { atc, step } from '@utils/decorators';

type Verb = 'PUT' | 'DELETE';

export interface StoredIdentity {
  id: string
  email: string | null
  displayName: string | null
}

export class DisplayNameApi extends ApiBase {
  private readonly endpoint = '/v1/me/display-name';

  constructor(options: TestContextOptions) {
    super(options);
  }

  @step
  async saveName(name: string): Promise<[APIResponse, DisplayNameResponse]> {
    const [response, body] = await this.apiPUT<DisplayNameResponse, DisplayNameBody>(this.endpoint, { display_name: name });
    expect(response.status()).toBe(200);
    return [response, body];
  }

  @step
  async removeName(): Promise<[APIResponse, DisplayNameResponse]> {
    const [response, body] = await this.apiDELETE<DisplayNameResponse>(this.endpoint);
    expect(response.status()).toBe(200);
    return [response, body];
  }

  @step
  async readIdentity(): Promise<StoredIdentity> {
    const [response, body] = await this.apiGET<MeResponse>(this.config.auth.meEndpoint);
    expect(response.status()).toBe(200);
    expect(body.user.email).not.toBeNull();
    return { id: body.user.id, email: body.user.email, displayName: body.user.display_name };
  }

  @step
  async readStoredName(): Promise<string | null> {
    return (await this.readIdentity()).displayName;
  }

  @step
  private async sendWrite(args: { verb: Verb, displayName?: string }): Promise<[APIResponse, ErrorEnvelope]> {
    if (args.verb === 'DELETE') {
      return this.apiDELETE<ErrorEnvelope>(this.endpoint);
    }
    if (args.displayName === undefined) {
      throw new Error('a PUT needs a displayName');
    }
    const [response, body] = await this.apiPUT<ErrorEnvelope, DisplayNameBody>(this.endpoint, { display_name: args.displayName });
    return [response, body];
  }

  private expectValidationRefusal(args: { body: ErrorEnvelope, message: string }): void {
    const details = args.body.error.details as { field?: string } | undefined;
    expect(args.body.error.code).toBe('validation_failed');
    expect(args.body.error.message).toBe(args.message);
    expect(details?.field).toBe('display_name');
  }

  @atc('BK-2105')
  async refuseBlankDisplayName(args: {
    value: string
    unchangedName: string | null
  }): Promise<[APIResponse, ErrorEnvelope, DisplayNameBody]> {
    const payload: DisplayNameBody = { display_name: args.value };
    const [response, body] = await this.apiPUT<ErrorEnvelope, DisplayNameBody>(this.endpoint, payload);

    expect(response.status()).toBe(422);
    this.expectValidationRefusal({ body, message: DISPLAY_NAME_MESSAGES.empty });
    expect(await this.readStoredName()).toBe(args.unchangedName);

    return [response, body, payload];
  }

  @atc('BK-2106')
  async saveDisplayNameWithinBounds(args: {
    value: string
    expectedStored: string
  }): Promise<[APIResponse, DisplayNameResponse, DisplayNameBody]> {
    const [response, body, payload] = await this.apiPUT<DisplayNameResponse, DisplayNameBody>(
      this.endpoint,
      { display_name: args.value },
    );

    expect(response.status()).toBe(200);
    expect(body.display_name).toBe(args.expectedStored);
    expect(await this.readStoredName()).toBe(args.expectedStored);

    return [response, body, payload];
  }

  @atc('BK-2107')
  async refuseTooLongDisplayName(args: {
    value: string
    unchangedName: string
  }): Promise<[APIResponse, ErrorEnvelope, DisplayNameBody]> {
    const payload: DisplayNameBody = { display_name: args.value };
    const [response, body] = await this.apiPUT<ErrorEnvelope, DisplayNameBody>(this.endpoint, payload);

    expect(response.status()).toBe(422);
    this.expectValidationRefusal({ body, message: DISPLAY_NAME_MESSAGES.tooLong });
    expect(await this.readStoredName()).toBe(args.unchangedName);

    return [response, body, payload];
  }

  @atc('BK-2117')
  async refuseWriteWithoutCredentials(args: {
    verb: Verb
    displayName?: string
  }): Promise<[APIResponse, ErrorEnvelope]> {
    const [response, body] = await this.sendWrite(args);

    expect(response.status()).toBe(401);
    expect(body.error.code).toBe('unauthorized');
    expect(body.error.message).toBe(DISPLAY_NAME_MESSAGES.unauthenticated);

    return [response, body];
  }

  @atc('BK-2118')
  async refuseWriteWithPersonalAccessToken(args: {
    verb: Verb
    displayName?: string
  }): Promise<[APIResponse, ErrorEnvelope]> {
    const [response, body] = await this.sendWrite(args);

    expect(response.status()).toBe(403);
    expect(body.error.code).toBe('forbidden');
    expect(body.error.message).toBe(DISPLAY_NAME_MESSAGES.patForbidden);

    return [response, body];
  }

  @atc('BK-2119')
  async writeOnlyOwnDisplayName(args: {
    newName: string
    extraFields: Record<string, unknown>
    expectedEmail: string
  }): Promise<[APIResponse, DisplayNameResponse, DisplayNameBody & Record<string, unknown>]> {
    const [response, body, payload] = await this.apiPUT<DisplayNameResponse, DisplayNameBody & Record<string, unknown>>(
      this.endpoint,
      { display_name: args.newName, ...args.extraFields },
    );

    expect(response.status()).toBe(200);
    expect(body.display_name).toBe(args.newName);
    const identity = await this.readIdentity();
    expect(identity.displayName).toBe(args.newName);
    expect(identity.email).toBe(args.expectedEmail);

    return [response, body, payload];
  }

  @atc('BK-2122')
  async writeAndRemoveDisplayNameSuccessfully(args: {
    newName: string
  }): Promise<[APIResponse, DisplayNameResponse]> {
    const [putResponse, putBody] = await this.apiPUT<DisplayNameResponse, DisplayNameBody>(
      this.endpoint,
      { display_name: args.newName },
    );
    expect(putResponse.status()).toBe(200);
    expect(putBody.display_name).toBe(args.newName);
    expect(await this.readStoredName()).toBe(args.newName);

    const [response, body] = await this.apiDELETE<DisplayNameResponse>(this.endpoint);
    expect(response.status()).toBe(200);
    expect(body.display_name).toBeNull();
    expect(await this.readStoredName()).toBeNull();

    return [response, body];
  }
}
