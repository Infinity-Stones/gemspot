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
      // 파일 상한은 10MiB다. multipart 경계와 파일 메타데이터도 요청 본문에
      // 들어가므로 서버 액션에는 그보다 조금 넉넉한 전송 상한을 둔다. 파일
      // 자체의 10MiB 상한은 uploadGuard와 서버 액션이 따로 강제한다.
      bodySizeLimit: '11mb',
    },
  },
  // 라우트로 인식할 확장자. 기본값에 md/mdx가 없으므로 사실상 동일하지만,
  // `.test.tsx`가 app/ 안에 떨어져도 라우트가 되지 않는 근거를 명시해 둔다.
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
};

export default nextConfig;
