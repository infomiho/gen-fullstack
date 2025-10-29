import { describe, it, expect } from 'vitest';
import type { PipelineStageEvent } from '@gen-fullstack/shared';
import {
  getStageIcon,
  getStageName,
  getStageSummary,
  getStatusIndicator,
  getStatusColor,
  getStatusLabel,
  getDetailedStatusText,
  getDetailedStatusColor,
} from '../stage-utils';
import { Layers, Code, AlertTriangle, Wrench, Package, CheckCircle } from 'lucide-react';

describe('stage-utils', () => {
  describe('getStageIcon', () => {
    it('should return correct icon and color for planning stage', () => {
      const result = getStageIcon('planning');
      expect(result.icon).toBe(Layers);
      expect(result.color).toBe('text-amber-500');
    });

    it('should return correct icon and color for code_generation stage', () => {
      const result = getStageIcon('code_generation');
      expect(result.icon).toBe(Code);
      expect(result.color).toBe('text-cyan-500');
    });

    it('should return correct icon and color for validation stage', () => {
      const result = getStageIcon('validation');
      expect(result.icon).toBe(AlertTriangle);
      expect(result.color).toBe('text-purple-500');
    });

    it('should return correct icon and color for error_fixing stage', () => {
      const result = getStageIcon('error_fixing');
      expect(result.icon).toBe(Wrench);
      expect(result.color).toBe('text-orange-500');
    });

    it('should return correct icon and color for template_loading stage', () => {
      const result = getStageIcon('template_loading');
      expect(result.icon).toBe(Package);
      expect(result.color).toBe('text-blue-500');
    });

    it('should return correct icon and color for completing stage', () => {
      const result = getStageIcon('completing');
      expect(result.icon).toBe(CheckCircle);
      expect(result.color).toBe('text-green-500');
    });
  });

  describe('getStageName', () => {
    it('should return correct display names for all stage types', () => {
      expect(getStageName('planning')).toBe('Planning Architecture');
      expect(getStageName('code_generation')).toBe('Code Generation');
      expect(getStageName('validation')).toBe('Validation');
      expect(getStageName('error_fixing')).toBe('Error Fixing');
      expect(getStageName('template_loading')).toBe('Template Loading');
      expect(getStageName('completing')).toBe('Completing');
    });
  });

  describe('getStageSummary', () => {
    it('should return "Failed" for any failed stage', () => {
      const stage: PipelineStageEvent = {
        id: '1',
        type: 'code_generation',
        status: 'failed',
        timestamp: Date.now(),
      };
      expect(getStageSummary(stage)).toBe('Failed');
    });

    describe('planning stage', () => {
      it('should show generating message when no plan data', () => {
        const stage: PipelineStageEvent = {
          id: '1',
          type: 'planning',
          status: 'started',
          timestamp: Date.now(),
        };
        expect(getStageSummary(stage)).toBe('Generating architectural plan...');
      });

      it('should show counts when plan data is available', () => {
        const stage: PipelineStageEvent = {
          id: '1',
          type: 'planning',
          status: 'completed',
          timestamp: Date.now(),
          data: {
            plan: {
              databaseModels: [{ name: 'User', fields: [] }],
              apiRoutes: [{ method: 'GET', path: '/api/users', description: 'Get users' }],
              clientComponents: [{ name: 'UserList', purpose: 'Display users' }],
            },
          },
        };
        expect(getStageSummary(stage)).toBe('1 models, 1 routes, 1 components');
      });
    });

    describe('code_generation stage', () => {
      it('should show "Generating code..." when started', () => {
        const stage: PipelineStageEvent = {
          id: '1',
          type: 'code_generation',
          status: 'started',
          timestamp: Date.now(),
        };
        expect(getStageSummary(stage)).toBe('Generating code...');
      });

      it('should show success message when completed', () => {
        const stage: PipelineStageEvent = {
          id: '1',
          type: 'code_generation',
          status: 'completed',
          timestamp: Date.now(),
        };
        expect(getStageSummary(stage)).toBe('Code generated successfully');
      });
    });

    describe('validation stage', () => {
      it('should show running message when no validation data', () => {
        const stage: PipelineStageEvent = {
          id: '1',
          type: 'validation',
          status: 'started',
          timestamp: Date.now(),
        };
        expect(getStageSummary(stage)).toBe('Running Prisma + TypeScript checks...');
      });

      it('should show no errors message when error count is 0', () => {
        const stage: PipelineStageEvent = {
          id: '1',
          type: 'validation',
          status: 'completed',
          timestamp: Date.now(),
          data: {
            validationErrors: [],
          },
        };
        expect(getStageSummary(stage)).toBe('✓ No errors found');
      });

      it('should show error count without iteration suffix', () => {
        const stage: PipelineStageEvent = {
          id: '1',
          type: 'validation',
          status: 'completed',
          timestamp: Date.now(),
          data: {
            validationErrors: [
              { type: 'typescript', file: 'test.ts', message: 'Error' },
              { type: 'prisma', file: 'schema.prisma', message: 'Error' },
            ],
          },
        };
        expect(getStageSummary(stage)).toBe('⚠️ Found 2 errors');
      });

      it('should show error count with iteration suffix', () => {
        const stage: PipelineStageEvent = {
          id: '1',
          type: 'validation',
          status: 'completed',
          timestamp: Date.now(),
          data: {
            validationErrors: [{ type: 'typescript', file: 'test.ts', message: 'Error' }],
            iteration: 2,
            maxIterations: 3,
          },
        };
        expect(getStageSummary(stage)).toBe('⚠️ Found 1 error (Retry 2/3)');
      });

      it('should use singular "error" for count of 1', () => {
        const stage: PipelineStageEvent = {
          id: '1',
          type: 'validation',
          status: 'completed',
          timestamp: Date.now(),
          data: {
            validationErrors: [{ type: 'typescript', file: 'test.ts', message: 'Error' }],
          },
        };
        expect(getStageSummary(stage)).toBe('⚠️ Found 1 error');
      });
    });

    describe('error_fixing stage', () => {
      it('should show fixing message with error count when started', () => {
        const stage: PipelineStageEvent = {
          id: '1',
          type: 'error_fixing',
          status: 'started',
          timestamp: Date.now(),
          data: {
            errorCount: 5,
            iteration: 1,
            maxIterations: 3,
          },
        };
        expect(getStageSummary(stage)).toBe('Fixing 5 errors (Attempt 1/3)');
      });

      it('should use singular "error" for count of 1', () => {
        const stage: PipelineStageEvent = {
          id: '1',
          type: 'error_fixing',
          status: 'started',
          timestamp: Date.now(),
          data: {
            errorCount: 1,
            iteration: 1,
            maxIterations: 3,
          },
        };
        expect(getStageSummary(stage)).toBe('Fixing 1 error (Attempt 1/3)');
      });

      it('should show success message when completed', () => {
        const stage: PipelineStageEvent = {
          id: '1',
          type: 'error_fixing',
          status: 'completed',
          timestamp: Date.now(),
          data: {
            errorCount: 5,
          },
        };
        expect(getStageSummary(stage)).toBe('✓ Errors fixed');
      });

      it('should handle missing errorCount gracefully', () => {
        const stage: PipelineStageEvent = {
          id: '1',
          type: 'error_fixing',
          status: 'started',
          timestamp: Date.now(),
          data: {},
        };
        expect(getStageSummary(stage)).toBe('Fixing 0 errors');
      });
    });

    describe('template_loading stage', () => {
      it('should show template name when available', () => {
        const stage: PipelineStageEvent = {
          id: '1',
          type: 'template_loading',
          status: 'completed',
          timestamp: Date.now(),
          data: {
            templateName: 'fullstack-monorepo',
          },
        };
        expect(getStageSummary(stage)).toBe('Copied fullstack-monorepo');
      });

      it('should show loading message when no template name', () => {
        const stage: PipelineStageEvent = {
          id: '1',
          type: 'template_loading',
          status: 'started',
          timestamp: Date.now(),
        };
        expect(getStageSummary(stage)).toBe('Loading template...');
      });
    });

    describe('completing stage', () => {
      it('should show custom summary when available', () => {
        const stage: PipelineStageEvent = {
          id: '1',
          type: 'completing',
          status: 'completed',
          timestamp: Date.now(),
          data: {
            summary: 'Generated a todo app',
          },
        };
        expect(getStageSummary(stage)).toBe('Generated a todo app');
      });

      it('should show default message when no summary', () => {
        const stage: PipelineStageEvent = {
          id: '1',
          type: 'completing',
          status: 'completed',
          timestamp: Date.now(),
        };
        expect(getStageSummary(stage)).toBe('Finalizing generation...');
      });
    });
  });

  describe('getStatusIndicator', () => {
    it('should return correct indicators for all statuses', () => {
      expect(getStatusIndicator('completed')).toBe('●');
      expect(getStatusIndicator('failed')).toBe('✕');
      expect(getStatusIndicator('started')).toBe('○');
    });
  });

  describe('getStatusColor', () => {
    it('should return correct colors for all statuses', () => {
      expect(getStatusColor('completed')).toBe('text-green-600');
      expect(getStatusColor('failed')).toBe('text-red-600');
      expect(getStatusColor('started')).toBe('text-gray-500');
    });
  });

  describe('getStatusLabel', () => {
    it('should return correct accessibility labels for all statuses', () => {
      expect(getStatusLabel('completed')).toBe('Completed');
      expect(getStatusLabel('failed')).toBe('Failed');
      expect(getStatusLabel('started')).toBe('In progress');
    });
  });

  describe('getDetailedStatusText', () => {
    it('should return correct detailed text for all statuses', () => {
      expect(getDetailedStatusText('completed')).toBe('Complete');
      expect(getDetailedStatusText('failed')).toBe('Failed');
      expect(getDetailedStatusText('started')).toBe('Running');
    });
  });

  describe('getDetailedStatusColor', () => {
    it('should return correct detailed colors for all statuses', () => {
      expect(getDetailedStatusColor('completed')).toBe('text-green-700 dark:text-green-400');
      expect(getDetailedStatusColor('failed')).toBe('text-red-700 dark:text-red-400');
      expect(getDetailedStatusColor('started')).toBe('text-yellow-700 dark:text-yellow-400');
    });
  });
});
