import 'vitest'
import type { AxeMatchers } from 'vitest-axe/matchers'

/**
 * vitest-axe 0.1.0 augments the LEGACY `Vi` global namespace only, which does
 * not connect to Vitest 5's module-based `Assertion` interface. This file adds
 * the missing augmentation. Type parameters mirror Vitest 5's declaration
 * exactly (interface merging requires identical type parameter lists).
 */
declare module 'vitest' {
  interface Assertion<_R extends void | Promise<void> = void, _T = unknown> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
