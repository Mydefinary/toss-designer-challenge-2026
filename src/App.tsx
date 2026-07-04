import { Routes, Route, Navigate } from 'react-router-dom';
import MeetingListScreen from './screens/meetings/MeetingListScreen';
import CreateScreen from './screens/CreateScreen';
import ConstraintsScreen from './screens/ConstraintsScreen';
import ResultScreen from './screens/ResultScreen';
import ConfirmScreen from './screens/ConfirmScreen';
import OperateScreen from './screens/OperateScreen';
import SharedView from './screens/shared/SharedView';
import AppShell from './components/AppShell';

/**
 * 멀티 회의 라우팅.
 * '/' 는 회의 목록, 각 회의는 '/m/:id/*' 하위 5단계(생성/제약입력/추천결과/확정/운영)로 이동한다.
 * '/shared/:id' 는 읽기 전용 공유 열람. 알 수 없는 경로는 목록으로 리다이렉트한다.
 */
export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<MeetingListScreen />} />
        <Route path="/m/:id/create" element={<CreateScreen />} />
        <Route path="/m/:id/constraints" element={<ConstraintsScreen />} />
        <Route path="/m/:id/result" element={<ResultScreen />} />
        <Route path="/m/:id/confirm" element={<ConfirmScreen />} />
        <Route path="/m/:id/operate" element={<OperateScreen />} />
        {/* 공유 상황 열람(읽기 전용 + 코멘트) */}
        <Route path="/shared/:id" element={<SharedView />} />
        {/* catch-all → 목록으로 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
