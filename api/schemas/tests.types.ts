import type { components, paths } from '@openapi';

export type TestCreateBody = components['schemas']['TestCreateBody'];
export type CreateAtcRequest = components['schemas']['AtcCreateBody'];

type TestPath = paths['/api/v1/tests/{id}'];

export type GetTestResponse = TestPath['get']['responses']['200']['content']['application/json'];

export type RenameTestRequest = NonNullable<TestPath['patch']['requestBody']>['content']['application/json'];
export type RenameTestResponse = TestPath['patch']['responses']['200']['content']['application/json'];

export type TestReorderBody = components['schemas']['TestReorderBody'];
export type TestTagsBody = components['schemas']['TestTagsBody'];

export type SearchTestsResponse = paths['/api/v1/tests/search']['get']['responses']['200']['content']['application/json'];

export type SearchPageResponse = components['schemas']['SearchPageResponse'];

type CreateTestPath = paths['/api/v1/tests']['post'];

export type CreateTestResponse = CreateTestPath['responses']['201']['content']['application/json'];

type CreateProjectPath = paths['/api/v1/workspaces/{id}/projects']['post'];

export type CreateProjectBody = components['schemas']['ProjectCreateBody'];
export type CreateProjectResponse = CreateProjectPath['responses']['201']['content']['application/json'];

export type CreateModuleBody = components['schemas']['ModuleCreateBody'];
export type CreateModuleResponse = paths['/api/v1/projects/{id}/modules']['post']['responses']['201']['content']['application/json'];

export type CreateUserStoryBody = components['schemas']['UserStoryCreateBody'];
export type CreateUserStoryResponse = paths['/api/v1/modules/{id}/user-stories']['post']['responses']['201']['content']['application/json'];

export type CreateAcceptanceCriterionBody = components['schemas']['AcceptanceCriterionCreateBody'];
export type CreateAcceptanceCriterionResponse = paths['/api/v1/user-stories/{id}/acceptance-criteria']['post']['responses']['201']['content']['application/json'];

export type CreateAtcResponse = paths['/api/v1/atcs']['post']['responses']['201']['content']['application/json'];

export type SearchAtcsResponse = paths['/api/v1/atcs/search']['get']['responses']['200']['content']['application/json'];

export type RestoreTestResponse = paths['/api/v1/tests/{id}/restore']['post']['responses']['200']['content']['application/json'];

export type FilterTestsResponse = paths['/api/v1/tests']['get']['responses']['200']['content']['application/json'];
export type FilteredTest = components['schemas']['FilteredTest'];

export type RunHistoryPage = components['schemas']['RunHistoryPage'];
export type RunHistoryItem = components['schemas']['RunHistoryItem'];

export type PlanMemberTestsResponse = components['schemas']['TestPlanMemberTestListResponse'];

export type StartRunBody = components['schemas']['RunCreateBody'];
export type StartRunResponse = paths['/api/v1/runs']['post']['responses']['201']['content']['application/json'];
export type MarkStepBody = components['schemas']['RunStepMarkBody'];
export type MarkStepResponse = paths['/api/v1/runs/{id}/steps/{stepId}/mark']['post']['responses']['200']['content']['application/json'];
export type FinishRunBody = components['schemas']['RunFinishBody'];
export type FinishRunResponse = paths['/api/v1/runs/{id}/finish']['post']['responses']['200']['content']['application/json'];

export type CreatePlanBody = components['schemas']['TestPlanCreateBody'];
export type CreatePlanResponse = components['schemas']['TestPlanCreateResponse'];
export type AddPlanTestsBody = components['schemas']['TestPlanAddTestsBody'];
export type AddPlanTestsResponse = components['schemas']['TestPlanAddTestsResponse'];
export type ClosePlanBody = components['schemas']['TestPlanCloseBody'];
export type ClosePlanResponse = components['schemas']['TestPlanClosureResponse'];

export type ListEnvironmentsResponse = components['schemas']['ProjectEnvironmentListResponse'];
export type CreateEnvironmentBody = components['schemas']['ProjectEnvironmentCreateBody'];
export type CreateEnvironmentResponse = components['schemas']['ProjectEnvironmentCreateResponse'];
