/**
 * Capability exports
 *
 * Simplified capability system with tool-based orchestration.
 * The LLM self-orchestrates via tools (planArchitecture, validatePrismaSchema, validateTypeScript).
 */

export { BaseCapability } from './base.capability.js';
export { UnifiedCodeGenerationCapability } from './unified-code-generation.capability.js';
export { TemplateCapability } from './template.capability.js';
