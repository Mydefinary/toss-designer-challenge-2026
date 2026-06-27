/** 결과 화면 공용 상수·포맷 헬퍼 */

/** 업무 시간 슬롯 (점심 12시 제외). lib/recommend 에서 export 되지 않아 여기서 정의. */
export const WORK_HOURS = [9, 10, 11, 13, 14, 15, 16, 17] as const;

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
