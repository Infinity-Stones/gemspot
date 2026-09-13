import type { ReactNode } from 'react';
import { css } from 'styled-system/css';
import { BrandLink } from './BrandLink';
import { pageDescription, pageTitle } from './uiStyles';

interface Props {
  title: string;
  /** 문장을 끊어 읽혀야 하면 줄바꿈을 담아 넘긴다. */
  description: ReactNode;
  children: ReactNode;
  guidance?: ReactNode;
}

// 입력 화면은 한 줄기로 내려간다. 제목을 왼쪽에 두고 폼을 오른쪽에 붙이면
// 넓은 화면에서 둘 사이가 벌어져, 읽던 자리와 채우는 자리가 끊긴다.
const shell = css({
  width: 'full',
  maxWidth: '2xl',
  mx: 'auto',
  px: { base: '5', md: '8' },
  pt: { base: '5', md: '8' },
  pb: '[calc(180px + env(safe-area-inset-bottom))]',
  display: 'flex',
  flexDirection: 'column',
  gap: '5',
});

const intro = css({ display: 'flex', flexDirection: 'column', gap: '2' });
const titleStyle = pageTitle;
const descriptionStyle = pageDescription;
// 보조 안내와 부가 이동 링크의 자리. 설명 문장과 같은 무게로 두면 화면을
// 끝내는 동작과 비켜 가는 길이 같아 보인다.
const guide = css({ textStyle: 'bodySm', color: 'ui.subtle' });
const content = css({ minWidth: '0', width: 'full' });

/** 입력 화면 셋의 지면과 타이포를 공유하고, 각 폼의 상태는 폼 안에 둔다. */
export function WorkflowPage({
  title,
  description,
  children,
  guidance,
}: Props) {
  return (
    <main className={shell}>
      <header className={intro}>
        <BrandLink />
        <h1 className={titleStyle}>{title}</h1>
        <p className={descriptionStyle}>{description}</p>
        {guidance !== undefined && <div className={guide}>{guidance}</div>}
      </header>
      <div className={content}>{children}</div>
    </main>
  );
}
