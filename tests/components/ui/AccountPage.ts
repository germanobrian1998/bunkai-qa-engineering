import type { Locator } from '@playwright/test';
import type { TestContextOptions } from '@TestContext';

import { DISPLAY_NAME_MESSAGES } from '@data/constants';
import { expect } from '@playwright/test';
import { UiBase } from '@ui/UiBase';
import { atc, step } from '@utils/decorators';

const MARKUP_ELEMENTS = 'b, img, a';
const HOME_SKELETONS = '[data-testid^="home-"][data-testid$="-skeleton"]';
const DISPLAY_NAME_REQUEST = /\/v1\/me\/display-name/;

export class AccountPage extends UiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  private readonly identityName = () => this.page.getByTestId('identity-display-name');
  private readonly greeting = () => this.page.getByTestId('home-welcome-greeting');
  private readonly welcomeBanner = () => this.page.getByTestId('home-welcome-banner');

  private async openSettings(): Promise<void> {
    await this.page.goto(this.buildUrl('/settings/account'));
    await expect(this.page.getByTestId('display-name-form')).toBeVisible();
  }

  private async openHome(): Promise<void> {
    await this.page.goto(this.buildUrl('/home'));
    await expect(this.welcomeBanner()).toBeVisible();
  }

  private async settle(): Promise<void> {
    await this.page.evaluate(async () => document.fonts.ready);
    await expect(this.page.locator(HOME_SKELETONS)).toHaveCount(0);
  }

  private async escapesScrollContainer(target: Locator): Promise<boolean> {
    const inner = await target.boundingBox();
    const container = await target.evaluate((element) => {
      let node: HTMLElement | null = element.parentElement;
      while (node) {
        const overflowX = getComputedStyle(node).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') {
          const rect = node.getBoundingClientRect();
          return { x: rect.x, width: rect.width };
        }
        node = node.parentElement;
      }
      return null;
    });
    if (!inner || !container) {
      throw new Error('the element and its scroll container must be rendered to measure containment');
    }
    return inner.x < container.x || inner.x + inner.width > container.x + container.width;
  }

  private async scrollContainerOverflows(target: Locator): Promise<boolean> {
    return target.evaluate((element) => {
      let node: HTMLElement | null = element.parentElement;
      while (node) {
        const overflowX = getComputedStyle(node).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') {
          return node.scrollWidth > node.clientWidth;
        }
        node = node.parentElement;
      }
      throw new Error('no horizontal scroll container found above the element');
    });
  }

  private async expectNoPageOverflow(target: Locator): Promise<void> {
    await expect.poll(async () => this.scrollContainerOverflows(target)).toBe(false);
    await expect.poll(async () => this.escapesScrollContainer(target)).toBe(false);
  }

  private async expectWithinCard(args: { inner: Locator, card: Locator }): Promise<void> {
    await expect.poll(async () => {
      const inner = await args.inner.boundingBox();
      const card = await args.card.boundingBox();
      if (!inner || !card) {
        throw new Error('both elements must be rendered to measure containment');
      }
      return inner.x < card.x || inner.x + inner.width > card.x + card.width;
    }).toBe(false);
  }

  private async expectOwnTextFits(args: { name: string, element: Locator }): Promise<void> {
    await expect(args.element).toContainText(args.name);
    await expect.poll(async () => args.element.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(false);
    await expect.poll(async () => args.element.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(false);
  }

  @step
  async gotoSettings(): Promise<void> {
    await this.openSettings();
  }

  @atc('BK-2100')
  async saveDisplayNameSuccessfully(args: { name: string, email: string }): Promise<void> {
    const input = this.page.getByTestId('display-name-input');
    await expect(input).toHaveValue('');
    await input.fill(args.name);

    const { status, requestBody } = await this.interceptResponse<{ display_name: string }, unknown>({
      action: async () => this.page.getByTestId('display-name-save').click(),
      urlPattern: DISPLAY_NAME_REQUEST,
    });

    expect(status).toBe(200);
    expect(requestBody?.display_name).toBe(args.name);
    await expect(this.page.getByText(DISPLAY_NAME_MESSAGES.saved)).toBeVisible();
    await expect(this.identityName()).toHaveText(args.name);
    await expect(this.page.getByTestId('identity-email')).toHaveText(args.email);
  }

  @atc('BK-2101')
  async greetWithSavedName(args: { savedName: string, greeting: string }): Promise<void> {
    await this.openHome();
    await expect(this.greeting()).toHaveText(args.greeting);
    await expect(this.greeting().locator(MARKUP_ELEMENTS)).toHaveCount(0);

    await this.openSettings();
    await expect(this.identityName()).toHaveText(args.savedName);
    await expect(this.identityName().locator(MARKUP_ELEMENTS)).toHaveCount(0);
  }

  @atc('BK-2134')
  async renderLongDisplayName(args: { name: string, viewport: { width: number, height: number } }): Promise<void> {
    await this.page.setViewportSize(args.viewport);

    await this.openSettings();
    await this.page.evaluate(async () => document.fonts.ready);
    await this.expectOwnTextFits({ name: args.name, element: this.identityName() });
    await this.expectWithinCard({ inner: this.identityName(), card: this.page.getByTestId('identity-card') });
    await this.expectNoPageOverflow(this.identityName());

    await this.openHome();
    await this.settle();
    await this.expectOwnTextFits({ name: args.name, element: this.greeting() });
    await expect.poll(async () => this.scrollContainerOverflows(this.greeting())).toBe(false);
  }
}
