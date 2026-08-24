export function useState<T>(
  initial: T | (() => T),
): [T, (value: T | ((previous: T) => T)) => void];
export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
export function useCallback<T extends (...args: never[]) => unknown>(
  callback: T,
  deps: readonly unknown[],
): T;
export function useEffect(
  effect: () => void | (() => void),
  deps?: readonly unknown[],
): void;
