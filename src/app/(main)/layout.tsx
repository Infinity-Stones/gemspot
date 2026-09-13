import type { ReactNode } from 'react';
import { FloatingNavigation } from '@/components/FloatingNavigation';

/**
 * 서비스 화면의 껍데기.
 *
 * 빠른 동작은 서비스 화면에만 둔다. 404는 자체 복귀 링크를 사용한다.
 */
export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <FloatingNavigation />
    </>
  );
}
