import type { NextConfig } from 'next';

/**
 * Next 설정 — 기본값에서 벗어나는 것만 적는다.
 *
 * React Compiler(`reactCompiler: true`)는 켜지 않았다. 켜려면
 * `babel-plugin-react-compiler`를 devDependency로 추가해야 하고, 그 순간 프로덕션
 * 빌드가 Babel 경로를 타서 빌드 시간이 늘어난다. 컴포넌트가 쌓이고 메모이제이션이
 * 실제 병목이 됐을 때 켜는 게 순서다 — 지금 켜면 얻는 것 없이 빌드만 느려진다.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // 서버 액션 본문 상한. 기본값이 1MB라 그보다 큰 스크린샷이 화면의 가드를
      // 지나고도 서버 앞에서 막혔다. 업로드 가드(MAX_IMAGE_BYTES)와 같은 값으로
      // 둔다 — 둘이 어긋나면 통과시킨 장이 전송에서 죽는다.
      bodySizeLimit: '10mb',
    },
  },
  // 라우트로 인식할 확장자. 기본값에 md/mdx가 없으므로 사실상 동일하지만,
  // `.test.tsx`가 app/ 안에 떨어져도 라우트가 되지 않는 근거를 명시해 둔다.
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
};

export default nextConfig;
