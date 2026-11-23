import type { components, paths } from '@openapi';

export type ExpandedTest = components['schemas']['ExpandedTest'];
export type ChainedAtc = components['schemas']['ChainedAtc'];
export type ArchivedTest = components['schemas']['ArchivedTest'];
export type TestCreateBody = components['schemas']['TestCreateBody'];
export type TestTagsBody = components['schemas']['TestTagsBody'];
export type TestReorderBody = components['schemas']['TestReorderBody'];
export type FilteredTest = components['schemas']['FilteredTest'];
export type TestSearchResult = components['schemas']['TestSearchResult'];
export type RunHistoryPage = components['schemas']['RunHistoryPage'];
export type RunHistoryItem = components['schemas']['RunHistoryItem'];
export type TestPlanMemberTestListResponse = components['schemas']['TestPlanMemberTestListResponse'];
export type StoryTraceabilityPayload = components['schemas']['StoryTraceabilityPayload'];
export type WorkspaceRuns = components['schemas']['WorkspaceRuns'];
export type RunComparison = components['schemas']['RunComparison'];
export type CreateAtcRequest = components['schemas']['AtcCreateBody'];
export type ActivityItemTestRenamed = components['schemas']['ActivityItemTestRenamed'];
export type ActivityItemTestArchived = components['schemas']['ActivityItemTestArchived'];
export type ActivityItemTestRestored = components['schemas']['ActivityItemTestRestored'];

type TestPath = paths['/api/v1/tests/{id}'];

export type GetTestResponse = TestPath['get']['responses']['200']['content']['application/json'];

export type RenameTestRequest = NonNullable<TestPath['patch']['requestBody']>['content']['application/json'];
export type RenameTestResponse = TestPath['patch']['responses']['200']['content']['application/json'];

type RestoreTestPath = paths['/api/v1/tests/{id}/restore']['post'];

export type RestoreTestResponse = RestoreTestPath['responses']['200']['content']['application/json'];

type ListTestRunsPath = paths['/api/v1/tests/{id}/runs']['get'];

export type ListTestRunsQuery = NonNullable<ListTestRunsPath['parameters']['query']>;
export type ListTestRunsResponse = ListTestRunsPath['responses']['200']['content']['application/json'];

type SetTagsPath = paths['/api/v1/tests/{id}/tags']['put'];

export type SetTestTagsResponse = SetTagsPath['responses']['200']['content']['application/json'];

type ReorderPath = paths['/api/v1/tests/{id}/reorder']['patch'];

export type ReorderTestResponse = ReorderPath['responses']['200']['content']['application/json'];

type ListTestsPath = paths['/api/v1/tests']['get'];

export type ListTestsByTagQuery = ListTestsPath['parameters']['query'];
export type ListTestsByTagResponse = ListTestsPath['responses']['200']['content']['application/json'];

type CreateTestPath = paths['/api/v1/tests']['post'];

export type CreateTestResponse = CreateTestPath['responses']['201']['content']['application/json'];

type SearchTestsPath = paths['/api/v1/tests/search']['get'];

export type SearchTestsQuery = SearchTestsPath['parameters']['query'];
export type SearchTestsResponse = SearchTestsPath['responses']['200']['content']['application/json'];
