import type { ReactNode } from 'react';
import { AppHeader } from '@/components/AppHeader';

/**
 * 서비스 화면의 껍데기.
 *
 * 헤더를 루트가 아니라 여기 두는 이유는 404 때문이다. 없는 주소로 들어온
 * 화면에까지 "동선 만들기 · 업로드"를 띄우면, 갈 수 없는 곳을 권하는 꼴이 된다.
 */
export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
