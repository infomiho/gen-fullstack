/**
 * Plan Architecture Display Component
 *
 * Renders a structured, collapsible view of the planned application architecture
 * including database models, API routes, and client components.
 */

import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown } from 'lucide-react';
import type { ApiRoute, ClientComponent, DatabaseModel } from '@gen-fullstack/shared';
import { radius, spacing, typography } from '../lib/design-tokens';

// Re-export types for convenience
export type { ApiRoute, ClientComponent, DatabaseModel };

export interface PlanArchitectureDisplayProps {
  databaseModels?: DatabaseModel[];
  apiRoutes?: ApiRoute[];
  clientComponents?: ClientComponent[];
}

export function PlanArchitectureDisplay({
  databaseModels,
  apiRoutes,
  clientComponents,
}: PlanArchitectureDisplayProps) {
  // Helper to render HTTP method badges with appropriate colors
  const renderMethodBadge = (method: string) => {
    const colors = {
      GET: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      POST: 'bg-green-500/10 text-green-500 border-green-500/20',
      PUT: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      DELETE: 'bg-red-500/10 text-red-500 border-red-500/20',
      PATCH: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    };
    const colorClass =
      colors[method as keyof typeof colors] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    return (
      <span
        className={`inline-block px-2 py-0.5 ${radius.sm} border ${typography.mono} text-xs font-medium ${colorClass}`}
      >
        {method}
      </span>
    );
  };

  return (
    <div className={`${typography.body} ${spacing.form}`}>
      {/* Database Models Section */}
      {databaseModels && databaseModels.length > 0 && (
        <Collapsible.Root defaultOpen={false} className="mb-4">
          <Collapsible.Trigger
            className="flex items-center gap-2 w-full group"
            aria-label={`Toggle database models section (${databaseModels.length} models)`}
          >
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
            <div className={`${typography.label} text-foreground`}>
              📊 Database Models ({databaseModels.length})
            </div>
          </Collapsible.Trigger>
          <Collapsible.Content className="mt-2">
            <div className={`${spacing.list} border-l-2 border-border pl-4`}>
              {databaseModels.map((model) => (
                <div key={model.name} className="mb-3 last:mb-0">
                  <div className={`${typography.mono} font-semibold text-foreground`}>
                    {model.name}
                  </div>
                  {model.fields && model.fields.length > 0 && (
                    <div className="ml-4 mt-1">
                      <div className="text-muted-foreground text-sm">Fields:</div>
                      <ul className="list-disc list-inside text-foreground text-sm">
                        {model.fields.map((field) => (
                          <li key={field} className={typography.mono}>
                            {field}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {model.relations && model.relations.length > 0 && (
                    <div className="ml-4 mt-1">
                      <div className="text-muted-foreground text-sm">Relations:</div>
                      <ul className="list-disc list-inside text-foreground text-sm">
                        {model.relations.map((relation) => (
                          <li key={relation} className={typography.mono}>
                            {relation}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Collapsible.Content>
        </Collapsible.Root>
      )}

      {/* API Routes Section */}
      {apiRoutes && apiRoutes.length > 0 && (
        <Collapsible.Root defaultOpen={false} className="mb-4">
          <Collapsible.Trigger
            className="flex items-center gap-2 w-full group"
            aria-label={`Toggle API routes section (${apiRoutes.length} routes)`}
          >
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
            <div className={`${typography.label} text-foreground`}>
              🔌 API Routes ({apiRoutes.length})
            </div>
          </Collapsible.Trigger>
          <Collapsible.Content className="mt-2">
            <div className={`${spacing.list}`}>
              {apiRoutes.map((route) => (
                <div
                  key={`${route.method}-${route.path}`}
                  className="mb-2 last:mb-0 flex gap-3 items-center"
                >
                  <div className="w-16 flex-shrink-0">{renderMethodBadge(route.method)}</div>
                  <div className="flex-1">
                    <div className={`${typography.mono} text-foreground font-medium`}>
                      {route.path}
                    </div>
                    <div className="text-muted-foreground text-sm">{route.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </Collapsible.Content>
        </Collapsible.Root>
      )}

      {/* Client Components Section */}
      {clientComponents && clientComponents.length > 0 && (
        <Collapsible.Root defaultOpen={false}>
          <Collapsible.Trigger
            className="flex items-center gap-2 w-full group"
            aria-label={`Toggle client components section (${clientComponents.length} components)`}
          >
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
            <div className={`${typography.label} text-foreground`}>
              ⚛️ Client Components ({clientComponents.length})
            </div>
          </Collapsible.Trigger>
          <Collapsible.Content className="mt-2">
            <div className={`${spacing.list} border-l-2 border-border pl-4`}>
              {clientComponents.map((component) => (
                <div key={component.name} className="mb-3 last:mb-0">
                  <div className={`${typography.mono} font-semibold text-foreground`}>
                    {component.name}
                  </div>
                  <div className="text-muted-foreground text-sm mt-1">{component.purpose}</div>
                  {component.key_features && component.key_features.length > 0 && (
                    <ul className="list-disc list-inside text-foreground text-sm mt-1 ml-4">
                      {component.key_features.map((feature) => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Collapsible.Content>
        </Collapsible.Root>
      )}
    </div>
  );
}
