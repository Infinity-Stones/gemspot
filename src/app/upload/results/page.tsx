import { css } from 'styled-system/css';
import { ExtractionResults } from '@/components/ExtractionResults';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '추출 결과',
  description: '스크린샷에서 찾은 장소와 주소를 확인합니다.',
};

const shell = css({
  width: 'full',
  maxWidth: '2xl',
  mx: 'auto',
  px: '6',
  py: '10',
  display: 'flex',
  flexDirection: 'column',
  gap: '8',
});

const heading = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
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

/**
 * 추출 결과 — 메인 플로우의 STEP 3.
 *
 * D03 결정에 따라 긴 확인·수정 작업을 감당하는 독립 페이지로 둔다. 지금은
 * T12의 추출 실행·전달이 없으므로 빈 후보를 받으며, 그 연결이 생기면 이 서버
 * 경계에서 후보를 읽어 `ExtractionResults`에 넘긴다.
 */
export default function UploadResultsPage() {
  return (
    <main className={shell}>
      <header className={heading}>
        <h1 className={title}>추출 결과</h1>
        <p className={lede}>
          주소가 맞는지 확인해 주세요. 확정하기 전에는 저장되지 않습니다.
        </p>
      </header>
      <ExtractionResults candidates={[]} />
    </main>
  );
}
