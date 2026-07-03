/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * 백엔드 base URL. 경로/same-origin 배포에서는 비워두면 상대경로('/api/meetsync/*')로 호출.
   * 다른 오리진 백엔드를 쓸 때만 절대 URL 을 지정한다.
   */
  readonly VITE_API_BASE?: string;
  /**
   * @deprecated same-origin 상대경로('/api/meetsync/parse-constraints')로 통일됨.
   * 하위호환용: 설정 시 자연어 파서 프록시 엔드포인트를 이 절대 URL 로 오버라이드한다.
   */
  readonly VITE_PARSE_ENDPOINT?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
