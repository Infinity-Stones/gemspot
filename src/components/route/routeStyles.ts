import { css } from 'styled-system/css';

export const panel = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
  p: '4',
  borderWidth: '1px',
  borderColor: 'slate.200',
  rounded: 'xl',
  bg: 'white',
  _dark: { bg: 'slate.950', borderColor: 'slate.800' },
});
export const muted = css({
  textStyle: 'sm',
  color: 'slate.600',
  _dark: { color: 'slate.400' },
});
export const actionButton = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  px: '3',
  py: '2',
  rounded: 'lg',
  borderWidth: '1px',
  borderColor: 'slate.300',
  cursor: 'pointer',
  textStyle: 'sm',
  fontWeight: 'medium',
  _hover: { bg: 'slate.100' },
  _disabled: { opacity: '0.5', cursor: 'not-allowed' },
  _dark: { borderColor: 'slate.700', _hover: { bg: 'slate.800' } },
});
export const field = css({
  width: 'full',
  rounded: 'lg',
  borderWidth: '1px',
  borderColor: 'slate.300',
  bg: 'white',
  px: '3',
  py: '2',
  color: 'slate.900',
  textStyle: 'md',
  _dark: { bg: 'slate.950', borderColor: 'slate.700', color: 'slate.100' },
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
