/**
 * KATA Architecture - Data Factory
 *
 * Generador centralizado de datos de prueba.
 * Regla de oro: NUNCA datos estáticos, siempre dinámicos con Faker.
 *
 * Acceso:
 *   - Desde componentes: this.data.createUser()
 *   - Import directo: import { DataFactory } from '@DataFactory'
 */

import type { CreateAtcPayload, TestCredentials, TestUser, TestWorkspace } from '@data/types';

import { faker } from '@faker-js/faker';

export class DataFactory {
  // ============================================
  // HELPERS PRIVADOS
  // ============================================

  private static uniqueId(): string {
    return `${Date.now()}-${faker.string.alphanumeric(6)}`;
  }

  private static testEmail(prefix = 'test'): string {
    const id = faker.string.alphanumeric(6).toLowerCase();
    const name = faker.person.firstName().toLowerCase();
    return `${prefix}.${name}.${id}@example.com`;
  }

  private static securePassword(): string {
    return `Test${faker.string.alphanumeric(8)}!`;
  }

  // ============================================
  // GENERADORES PRINCIPALES
  // ============================================

  /**
   * Genera un usuario completo para testing
   * @param overrides - Propiedades a sobreescribir
   */
  static createUser(overrides?: Partial<TestUser>): TestUser {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    return {
      email: this.testEmail(),
      password: this.securePassword(),
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      ...overrides,
    };
  }

  /**
   * Genera solo credenciales (email + password)
   * @param overrides - Propiedades a sobreescribir
   */
  static createCredentials(overrides?: Partial<TestCredentials>): TestCredentials {
    return {
      email: this.testEmail(),
      password: this.securePassword(),
      ...overrides,
    };
  }

  /**
   * Genera un ID único para identificar datos de test
   * Útil para cleanup y trazabilidad
   */
  static createTestId(prefix = 'test'): string {
    return `${prefix}-${this.uniqueId()}`;
  }

  // ============================================
  // PROJECT-SPECIFIC
  // ============================================

  /**
   * Genera nombre + slug únicos de Workspace.
   * El slug cumple ^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$ (minúsculas, dígitos y guiones).
   * @param overrides - Propiedades a sobreescribir
   */
  static createWorkspace(overrides?: Partial<TestWorkspace>): TestWorkspace {
    const id = this.createTestId('kata').toLowerCase();
    return {
      name: `KATA Workspace ${id}`,
      slug: id,
      ...overrides,
    };
  }

  static createDisplayName(): string {
    return `Kata ${faker.person.lastName()} ${faker.string.alpha({ length: 4, casing: 'mixed' })}`;
  }

  static createTestTitle(): string {
    return `Kata Test ${this.createTestId('bk596')}`;
  }

  static createTitleOfLength(args: { character: string, count: number }): string {
    return args.character.repeat(args.count);
  }

  static createTagName(): string {
    return `kata-bk596-${faker.string.alphanumeric({ length: 8, casing: 'lower' })}`;
  }

  static createModuleName(): string {
    return `Kata module ${this.createTestId('bk596')}`;
  }

  static createAtcPayload(args: { moduleId: string, userStoryId: string, acceptanceCriterionIds: string[] }): CreateAtcPayload {
    return {
      title: `Kata ATC ${this.createTestId('bk596')}`,
      module_id: args.moduleId,
      user_story_id: args.userStoryId,
      acceptance_criterion_ids: args.acceptanceCriterionIds,
      layer: 'API',
      steps: [
        { position: 1, content: faker.lorem.sentence() },
        { position: 2, content: faker.lorem.sentence() },
      ],
    };
  }
}

export default DataFactory;
