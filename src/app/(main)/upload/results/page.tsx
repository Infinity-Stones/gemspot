import { css } from 'styled-system/css';
import { pageDescription, pageTitle } from '@/components/uiStyles';
import { BackLink } from '@/components/BackLink';
import { BrandLink } from '@/components/BrandLink';
import { ExtractionResultsFromSession } from '@/components/ExtractionResultsFromSession';
import { UPLOAD_PATH } from '@/shared/routes';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '추출 결과',
  description: '스크린샷에서 찾은 장소와 주소를 확인합니다.',
};

const shell = css({
  width: 'full',
  maxWidth: '3xl',
  mx: 'auto',
  px: '6',
  pt: { base: '5', md: '10' },
  pb: '[calc(104px + env(safe-area-inset-bottom))]',
  display: 'flex',
  flexDirection: 'column',
  gap: '8',
});

const heading = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '5',
});

const title = pageTitle;

const lede = pageDescription;

/**
 * 추출 결과 — 메인 플로우의 STEP 3.
 *
 * D03 결정에 따라 긴 확인·수정 작업을 감당하는 독립 페이지로 둔다.
 *
 * 후보는 업로드 화면이 세션에 넘긴 것을 읽는다(T53 · #110). 서버 경계에서 읽지
 * 않는 이유는 확정 전 후보가 서버 어디에도 남지 않아야 하기 때문이다 —
 * 사용자가 확정해야 스팟이 된다는 것이 STEP 3의 전제다. 그 판단은
 * `src/app/upload/extractState.ts`에 적었다.
 */
export default function UploadResultsPage() {
  return (
    <main className={shell}>
      <BrandLink />
      <BackLink href={UPLOAD_PATH} label="업로드로 돌아가기" />
      <header className={heading}>
        <h1 className={title}>추출 결과</h1>
        <p className={lede}>
          주소가 맞는지 확인해 주세요. 확정하기 전에는 저장되지 않습니다.
        </p>
      </header>
      <ExtractionResultsFromSession />
    </main>
  );
}
