import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/styles/globals.css';
import { THEME_INIT_SCRIPT } from './theme-script';

export const metadata: Metadata = {
  title: {
    default: 'gemspot',
    template: '%s · gemspot',
  },
  description: '레이어 경계와 디자인 토큰을 lint로 강제하는 Next.js 스캐폴드.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-theme의 초기값은 라이트다. 서버는 사용자의 선택을 모르므로 한쪽을
    // 골라야 하고, 아래 스크립트가 첫 페인트 전에 실제 값으로 덮어쓴다.
    // suppressHydrationWarning은 그 덮어쓰기 때문이다 — 서버 HTML과 하이드레이션
    // 시점의 DOM이 이 속성 하나에서 다른 것은 **의도된 것**이고, 이게 없으면
    // React가 매 로드마다 경고를 찍는다. <html> 엘리먼트에만 걸리므로 자식
    // 트리의 진짜 불일치는 그대로 보고된다.
    <html lang="ko" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
