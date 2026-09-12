import Link from 'next/link';
import { css } from 'styled-system/css';
import { UploadForm } from '@/components/UploadForm';
import { SPOT_NEW_PATH } from '@/shared/routes';
import type { Metadata } from 'next';

/**
 * 업로드 — 메인 플로우의 STEP 1.
 *
 * 웹으로 배포하므로 시작점은 사용자가 **이미 저장해 둔** 이미지를 올리는
 * 것이다. 카메라로 찍는 경로는 없다.
 *
 * 이 파일은 서버 컴포넌트로 남긴다. 고른 파일을 들고 있는 상태만 클라이언트에
 * 있으면 되고(`UploadForm`), 화면의 틀까지 클라이언트로 내리면 그 만큼이
 * 번들에 실린다.
 */

export const metadata: Metadata = {
  title: '스크린샷 올리기',
  description: '저장해 둔 가게 스크린샷을 올려 스팟으로 만듭니다.',
};

const shell = css({
  maxWidth: '2xl',
  mx: 'auto',
  px: '6',
  py: '12',
  display: 'flex',
  flexDirection: 'column',
  gap: '8',
});

const title = css({
  textStyle: '3xl',
  fontWeight: 'bold',
  letterSpacing: 'tight',
});

const lede = css({
  textStyle: 'md',
  color: 'slate.600',
  _dark: { color: 'slate.400' },
});

// 스크린샷이 없어도 들어올 수 있는 두 번째 입구(T51).
const altEntry = css({
  textStyle: 'sm',
  color: 'violet.700',
  textDecoration: 'underline',
  _dark: { color: 'violet.300' },
});

export default function UploadPage() {
  return (
    <main className={shell}>
      <div>
        <h1 className={title}>스크린샷 올리기</h1>
      </div>
      <p className={lede}>
        가게 이름과 주소가 찍힌 스크린샷 한 장을 고르세요. 한 장 안에 가게가
        여러 곳이면 각각 따로 뽑습니다.
      </p>
      <UploadForm />
      <p>
        <Link className={altEntry} href={SPOT_NEW_PATH}>
          주소를 알고 있다면 직접 핀 찍기 →
        </Link>
      </p>
    </main>
  );
}
