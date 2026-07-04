/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
// 경로 배포로 전환됨: 기존 GitHub Pages(프로젝트/사용자 페이지) 방식 대신,
// MEETSYNC 를 기존 사이트의 경로 `/meetsync/` 아래에 서빙한다(same-origin API).
// - 프로덕션 빌드: base '/meetsync/' → asset 경로가 '/meetsync/assets/...' 로 생성됨.
// - 개발 서버: base '/' (로컬 편의).
// HashRouter 라 라우팅 자체는 base 와 무관하지만, asset(js/css) 경로 때문에 base 가 필요하다.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/meetsync/' : '/',
  plugins: [react()],
  server: {
    // 로컬 dev 프록시: '/api/*' 요청을 MEETSYNC 독립 백엔드(server/, 포트 8010)로 프록시한다.
    // 이걸로 로컬에서도 same-origin 상대경로('/api/meetsync/*')가 프로덕션과 동일하게 동작.
    // (이전에는 정치불신 백엔드 8000 에 얹혀 있었으나 8010 독립 백엔드로 분리됨)
    // 백엔드 로컬 포트가 다르면 아래 target 을 조정한다.
    proxy: {
      '/api': {
        target: 'http://localhost:8010',
        changeOrigin: true,
      },
    },
  },
  test: {
    // 알고리즘은 순수 함수라 DOM 이 필요 없다 → node 환경에서 빠르게 실행
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
}));
