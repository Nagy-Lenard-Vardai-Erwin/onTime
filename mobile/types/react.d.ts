declare module 'react' {
  export type ReactNode = any;

  export namespace JSX {
    interface Element extends any {}
    interface IntrinsicElements {
      [elemName: string]: unknown;
    }
  }

  export type ComponentType<P = object> = (props: P) => any;

  export function useState<S>(
    initial: S | (() => S),
  ): [S, (value: S | ((prev: S) => S)) => void];

  export function useEffect(
    effect: () => void | (() => void),
    deps?: readonly unknown[],
  ): void;

  export function useCallback<T extends (...args: never[]) => unknown>(
    callback: T,
    deps: readonly unknown[],
  ): T;

  export function useRef<T>(initialValue: T): {current: T};
  export function useRef<T = undefined>(): {current: T | undefined};

  const React: {
    useState: typeof useState;
    useEffect: typeof useEffect;
    useCallback: typeof useCallback;
    useRef: typeof useRef;
  };

  export default React;
}
