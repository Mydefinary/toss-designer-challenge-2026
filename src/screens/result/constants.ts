/** 결과 화면 공용 포맷·아이콘 헬퍼 (블럭 목록은 lib/recommend 의 VALID_BLOCKS 사용) */

/** 정수면 그대로, 소수면 한 자리로 표기 ( -1.5, 3 ) */
export function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** 부호를 붙여 표기 ( +3, -1.5 ) */
export function signed(n: number): string {
  return n >= 0 ? `+${formatNum(n)}` : formatNum(n);
}

/** 상태별 접근성 아이콘 (색맹 대비) */
export const STATUS_ICON = {
  available: '●',
  avoid: '▲',
  unavailable: '✕',
} as const;
