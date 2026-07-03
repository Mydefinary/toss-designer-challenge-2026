/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PARSE_ENDPOINT?: string;
  readonly VITE_API_BASE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
