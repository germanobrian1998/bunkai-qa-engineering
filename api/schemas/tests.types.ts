import type { components, paths } from '@openapi';

export type TestCreateBody = components['schemas']['TestCreateBody'];
export type CreateAtcRequest = components['schemas']['AtcCreateBody'];

type TestPath = paths['/api/v1/tests/{id}'];

export type GetTestResponse = TestPath['get']['responses']['200']['content']['application/json'];

export type RenameTestRequest = NonNullable<TestPath['patch']['requestBody']>['content']['application/json'];
export type RenameTestResponse = TestPath['patch']['responses']['200']['content']['application/json'];

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
