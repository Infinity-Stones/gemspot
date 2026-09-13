import type { ReactNode } from 'react';
import { css } from 'styled-system/css';
import { BrandLink } from './BrandLink';

interface Props {
  title: string;
  description: string;
  children: ReactNode;
  guidance?: ReactNode;
  layout?: 'split' | 'stacked';
}

const shell = css({
  width: 'full',
  maxWidth: 'page',
  mx: 'auto',
  px: { base: '5', md: '8' },
  pt: { base: '5', md: '10' },
  pb: '[calc(224px + env(safe-area-inset-bottom))]',
  display: 'grid',
  gridTemplateColumns: {
    base: 'minmax(0, 1fr)',
    lg: 'minmax(0, 0.9fr) minmax(0, 1fr)',
  },
  alignItems: 'start',
  gap: { base: '10', lg: '16' },
  '&[data-layout=stacked]': {
    maxWidth: '3xl',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: '10',
  },
});

const intro = css({ display: 'flex', flexDirection: 'column', gap: '6' });
const titleStyle = css({
  textStyle: { base: 'headingLg', md: 'display' },
  textWrap: 'balance',
});
const descriptionStyle = css({
  maxWidth: 'md',
  textStyle: 'body',
  color: 'ui.subtle',
});
const guide = css({
  mt: { base: '2', lg: '10' },
  textStyle: 'bodySm',
  color: 'ui.subtle',
  '[data-layout=stacked] &': { mt: '2' },
});
const content = css({
  minWidth: '0',
  width: 'full',
  pt: { lg: '12' },
  '[data-layout=stacked] &': { pt: '0' },
});

/** 입력 화면 셋의 지면과 타이포를 공유하고, 각 폼의 상태는 폼 안에 둔다. */
export function WorkflowPage({
  title,
  description,
  children,
  guidance,
  layout = 'split',
}: Props) {
  return (
    <main className={shell} data-layout={layout}>
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
