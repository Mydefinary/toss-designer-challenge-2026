/** (헤더) 시나리오 컨텍스트 — 회의 제목 + 장소 배지 + 시나리오 라벨 */
import { Badge } from '../../components/ui';
import { useConfig, useScenarioMeta } from '../../store';
import styles from './result.module.css';

export default function ResultHeader() {
  const config = useConfig();
  const meta = useScenarioMeta();
  const isOnline = config.location === 'online';

  return (
    <header className={styles.header}>
      <div className={styles.headerTopRow}>
        <h1 className={styles.headerTitle}>{config.title}</h1>
        <Badge tone={isOnline ? 'available' : 'neutral'}>
          {isOnline ? '온라인' : '오프라인'}
        </Badge>
      </div>
      <p className={styles.headerSubtitle}>{meta.name}</p>
    </header>
  );
}
