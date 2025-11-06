/**
 * oRPC Client Setup
 *
 * Type-safe RPC client for communicating with the server.
 * Auto-infers types from the server router definition.
 */

import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { RouterClient } from '@orpc/server';
import type { sessionsRouter } from '@gen-fullstack/server/src/routers/sessions.router.js';
import { env } from './env';

/**
 * Create the RPC link with fetch configuration
 */
const link = new RPCLink({
  url: `${env.VITE_API_URL}/api/rpc`,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Create the typed oRPC client
 *
 * Full type inference from server router.
 * All procedure calls are type-checked at compile time.
 */
export const orpc: RouterClient<typeof sessionsRouter> = createORPCClient(link);
