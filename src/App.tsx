import { Routes, Route, Navigate } from 'react-router-dom';
import CreateScreen from './screens/CreateScreen';
import ConstraintsScreen from './screens/ConstraintsScreen';
import ResultScreen from './screens/ResultScreen';
import ConfirmScreen from './screens/ConfirmScreen';
import OperateScreen from './screens/OperateScreen';
import SharedView from './screens/shared/SharedView';
import AppShell from './components/AppShell';

/**
 * 라우팅 스켈레톤 — 5개 화면(생성/제약입력/추천결과/확정/운영)만 연결.
 * 실제 화면 UI 는 트랙 C·D·E 에서 구현한다.
 */
export default function App() {
  return (
    <AppShell>
      <Routes>
      <Route path="/" element={<Navigate to="/create" replace />} />
      <Route path="/create" element={<CreateScreen />} />
      <Route path="/constraints" element={<ConstraintsScreen />} />
      <Route path="/result" element={<ResultScreen />} />
      <Route path="/confirm" element={<ConfirmScreen />} />
      <Route path="/operate" element={<OperateScreen />} />
      {/* 공유 상황 열람(읽기 전용 + 코멘트) */}
      <Route path="/shared/:id" element={<SharedView />} />
      {/* catch-all → 생성 화면으로 */}
      <Route path="*" element={<Navigate to="/create" replace />} />
      </Routes>
    </AppShell>
  );
}
