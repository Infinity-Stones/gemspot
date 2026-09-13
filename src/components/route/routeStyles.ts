import { css } from 'styled-system/css';

export { defaultButton as actionButton, input as field } from '../uiStyles';

export const panel = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
  p: '4',
  rounded: 'panel',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'ui.line',
  bg: 'ui.surface',
});

export const muted = css({
  textStyle: 'bodySm',
  color: 'ui.subtle',
});

export const row = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '2',
  alignItems: 'center',
});

export const stack = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '3',
});
