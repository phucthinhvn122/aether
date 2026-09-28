/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set only by CI for the simulator smoke-test build. */
  readonly VITE_NATIVE_SELFTEST?: string;
}
