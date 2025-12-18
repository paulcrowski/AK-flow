declare module 'react' {
  export type ReactNode = any;

  export interface Context<T> {
    Provider: any;
    Consumer: any;
  }

  export function createContext<T>(defaultValue: T): Context<T>;
  export function useState<S>(initialState: S | (() => S)): [S, (next: S | ((prev: S) => S)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useRef<T>(initialValue: T): { current: T };
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps: any[]): T;
  export function useMemo<T>(factory: () => T, deps: any[]): T;

  export interface FC<P = {}> {
    (props: P): any;
  }

  const React: any;
  export default React;
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
