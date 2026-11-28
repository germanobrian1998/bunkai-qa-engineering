import type { ApiFixture } from '@ApiFixture';

import { TestContext } from '@TestContext';

export interface OfferSurfaces {
  palette: boolean
  planPicker: boolean
  tagFilter: boolean
  chatPicker: boolean
}

export interface AtcUsageRead {
  count: number
  archivedCount: number
  listed: boolean
}

export interface OfferRead {
  surfaces: OfferSurfaces
  atcUsage: AtcUsageRead
}

export interface OfferedTest {
  testId: string
  title: string
  tag: string
  atcId: string
  projectId: string
  workspaceId: string
}

export class OfferSurfaceSteps extends TestContext {
  constructor() {
    super();
  }

  async readOffers(args: { session: ApiFixture, scopedSession: ApiFixture, offered: OfferedTest }): Promise<OfferRead> {
    const { session, scopedSession, offered } = args;
    const [, palette] = await scopedSession.search.searchPalette(offered.title);
    const [, planPicker] = await session.tests.searchTests({ title: offered.title, projectId: offered.projectId });
    const [, tagged] = await scopedSession.tests.listByTag(offered.tag);
    const [, chat] = await session.search.searchChatEntities({ workspaceId: offered.workspaceId, query: offered.title });
    const [, usage] = await session.atcs.readAtcUsage(offered.atcId);
    return {
      surfaces: {
        palette: palette.data.some(item => item.entity_type === 'test' && item.id === offered.testId),
        planPicker: planPicker.items.some(item => item.id === offered.testId),
        tagFilter: tagged.some(item => item.id === offered.testId),
        chatPicker: chat.items.some(item => item.type === 'test' && item.id === offered.testId),
      },
      atcUsage: {
        count: usage.count,
        archivedCount: usage.archived_count,
        listed: usage.used_in.some(entry => entry.test_id === offered.testId),
      },
    };
  }
}
