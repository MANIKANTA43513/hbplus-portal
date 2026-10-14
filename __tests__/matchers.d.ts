// Type declarations for the custom matchers that expo-router/testing-library registers at runtime.
declare namespace jest {
  interface Matchers<R> {
    toHavePathname(pathname: string): R;
  }
}
