/**
 * Capability exports
 *
 * Capabilities are composable units that perform specific tasks during
 * app generation. They can be combined in different ways to create
 * flexible generation pipelines.
 */

export { BaseCapability } from './base.capability.js';
export { TemplateCapability } from './template.capability.js';
export { PlanningCapability } from './planning.capability.js';
export { CodeGenerationCapability } from './code-generation.capability.js';
export { ValidationCapability } from './validation.capability.js';
export { ErrorFixingCapability } from './error-fixing.capability.js';
