/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages 배포 시: 저장소 이름에 맞춰 아래 base 를 활성화한다.
  // 예) https://<user>.github.io/REPO_NAME/ 로 서빙되면 base 를 '/REPO_NAME/' 로 설정해야
  //     에셋 경로가 깨지지 않는다. (HashRouter 와 함께 사용)
  // base: '/REPO_NAME/',
  test: {
    // 알고리즘은 순수 함수라 DOM 이 필요 없다 → node 환경에서 빠르게 실행
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
