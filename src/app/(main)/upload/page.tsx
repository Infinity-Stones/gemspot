import Link from 'next/link';
import { css } from 'styled-system/css';
import { UploadForm } from '@/components/UploadForm';
import { WorkflowPage } from '@/components/WorkflowPage';
import { SPOT_NEW_PATH } from '@/shared/routes';
import { extractAction } from './actions';
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
  title: '스크린샷 업로드',
  description: '저장해 둔 가게 스크린샷을 올려 스팟으로 만듭니다.',
};

const alternative = css({
  color: 'ui.ink',
  textDecoration: 'underline',
  textUnderlineOffset: '[4px]',
  _hover: { color: 'ui.accentText' },
});

export default function UploadPage() {
  return (
    <WorkflowPage
      title="스크린샷 업로드"
      description={
        <>
          저장해 둔 한 장을, 가 보고 싶은 장소로.
          <br />
          가게 이름과 주소가 담긴 스크린샷을 골라 주세요.
        </>
      }
      guidance={
        <Link className={alternative} href={SPOT_NEW_PATH}>
          주소를 알고 있다면 직접 핀 찍기
        </Link>
      }
    >
      <UploadForm action={extractAction} />
    </WorkflowPage>
  );
}
