/**
 * Store Utilities
 *
 * Utility types for Zustand stores to reduce boilerplate
 * and ensure consistent patterns across the application.
 */

/**
 * Compose a Zustand store from separate state and actions interfaces
 *
 * @example
 * ```typescript
 * interface MyState {
 *   count: number;
 * }
 *
 * interface MyActions {
 *   increment: () => void;
 * }
 *
 * type MyStore = Store<MyState, MyActions>;
 * ```
 */
export type Store<State, Actions> = State & Actions;
