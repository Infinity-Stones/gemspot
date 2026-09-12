import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PinFormState } from '@/app/spots/new/pinState';
import type { PinSpotAction } from './PinByAddressForm';
import { PinByAddressForm } from './PinByAddressForm';

const DRAFT = { name: '피롤츠 커피하우스', address: '서울 용산구 한강대로 56-1', category: 'cafe' as const };
const LOCATED: PinFormState = {
  status: 'located',
  draft: DRAFT,
  location: {
    coordinates: { latitude: 37.5299, longitude: 126.9648 },
    roadAddress: '서울특별시 용산구 한강대로 56-1',
    jibunAddress: '서울특별시 용산구 한강로3가 40-999',
    region: { sido: '서울특별시', sigugun: '용산구' },
  },
};

function recording(state: PinFormState, seen: Record<string, string>[]): PinSpotAction {
  return vi.fn((_prev: PinFormState, formData: FormData) => {
    seen.push(Object.fromEntries([...formData.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : v.name])));
    return Promise.resolve(state);
  });
}

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('장소 이름'), DRAFT.name);
  await user.type(screen.getByLabelText('주소'), DRAFT.address);
  await user.selectOptions(screen.getByLabelText('카테고리'), 'cafe');
}

describe('PinByAddressForm', () => {
  it('처음에는 위치 찾기만 있고 저장 버튼은 없다 — 미리보기를 건너뛰고 저장할 수 없다', () => {
    render(<PinByAddressForm action={recording({ status: 'idle' }, [])} />);
    expect(screen.getByRole('button', { name: '위치 찾기' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '이 위치로 저장' })).not.toBeInTheDocument();
  });

  it('위치 찾기는 intent=locate로 이름 · 주소 · 카테고리를 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Record<string, string>[] = [];
    render(<PinByAddressForm action={recording(LOCATED, seen)} />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: '위치 찾기' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(seen[0]).toMatchObject({ intent: 'locate', name: DRAFT.name, address: DRAFT.address, category: 'cafe' });
  });

  it('좌표가 확인되면 미리보기와 정규화 주소, 저장 버튼이 나타난다', async () => {
    const user = userEvent.setup();
    render(<PinByAddressForm action={recording(LOCATED, [])} />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: '위치 찾기' }));

    await waitFor(() => {
      expect(screen.getByRole('region', { name: '찾은 위치 미리보기' })).toBeInTheDocument();
    });
    expect(screen.getByText('서울특별시 용산구 한강대로 56-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이 위치로 저장' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 찾기' })).toBeInTheDocument();
  });

  it('저장 버튼은 intent=save를 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Record<string, string>[] = [];
    // 첫 제출은 located, 둘째는 저장(리다이렉트 대신 같은 상태를 돌려준다)
    render(<PinByAddressForm action={recording(LOCATED, seen)} />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: '위치 찾기' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '이 위치로 저장' })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: '이 위치로 저장' }));

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    expect(seen[1]?.['intent']).toBe('save');
  });

  it('주소를 못 찾으면 그 자리에서 다시 입력하라고 말하고 저장 버튼은 열지 않는다', async () => {
    const user = userEvent.setup();
    const failed: PinFormState = { status: 'failed', draft: DRAFT, failure: { kind: 'address_not_found' } };
    render(<PinByAddressForm action={recording(failed, [])} />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: '위치 찾기' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('위치를 찾지 못했어요');
    });
    expect(screen.queryByRole('button', { name: '이 위치로 저장' })).not.toBeInTheDocument();
  });

  it('저장소가 없으면 환경 변수 이름을 알려 준다', async () => {
    const user = userEvent.setup();
    const failed: PinFormState = { status: 'failed', draft: DRAFT, failure: { kind: 'store_unconfigured' } };
    render(<PinByAddressForm action={recording(failed, [])} />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: '위치 찾기' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('SUPABASE_URL');
    });
  });
});
