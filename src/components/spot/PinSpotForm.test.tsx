import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PinFormState } from '@/app/spots/new/pinState';
import type { PinSpotAction } from './PinSpotForm';
import { PinSpotForm } from './PinSpotForm';

const DRAFT = {
  name: '피롤츠 커피하우스',
  address: '서울 용산구 한강대로 56-1',
  category: 'cafe' as const,
};
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

function recording(
  state: PinFormState,
  seen: Record<string, string>[],
): PinSpotAction {
  return vi.fn((_prev: PinFormState, formData: FormData) => {
    seen.push(
      Object.fromEntries(
        [...formData.entries()].map(([k, v]) => [
          k,
          typeof v === 'string' ? v : v.name,
        ]),
      ),
    );
    return Promise.resolve(state);
  });
}

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('가게 이름'), DRAFT.name);
  await user.type(screen.getByLabelText('주소'), DRAFT.address);
  await user.selectOptions(screen.getByLabelText('카테고리'), 'cafe');
}

describe('PinSpotForm', () => {
  it('가게 이름으로 찾기는 intent=search_place로 이름을 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Record<string, string>[] = [];
    const placeSearched: PinFormState = {
      status: 'place_searched',
      draft: DRAFT,
      places: [
        {
          name: '피롤츠 커피하우스',
          category: '카페',
          address: '서울 용산구 한강대로 56-1',
          secondaryAddress: null,
        },
        {
          name: '피롤츠 로스터리',
          category: '카페',
          address: '서울 용산구 한강대로 60',
          secondaryAddress: null,
        },
      ],
    };
    render(<PinSpotForm action={recording(placeSearched, seen)} />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: '검색' }));

    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: '가게 검색 결과' }),
      ).toBeInTheDocument();
    });
    expect(seen[0]).toMatchObject({ intent: 'search_place', name: DRAFT.name });
    // 5건 상한을 숨기지 않는다
    expect(screen.getByText(/최대 5곳/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '이 위치로 저장' }),
    ).not.toBeInTheDocument();
  });

  it('가게를 고르면 pickPlace=<번호>가 실리고, 서버가 채운 이름 · 주소가 칸에 보인다', async () => {
    const user = userEvent.setup();
    const seen: Record<string, string>[] = [];
    const places = [
      {
        name: '피롤츠 커피하우스',
        category: '카페',
        address: '서울 용산구 한강대로 56-1',
        secondaryAddress: null,
      },
      {
        name: '피롤츠 로스터리',
        category: '카페',
        address: '서울 용산구 한강대로 60',
        secondaryAddress: null,
      },
    ];
    let call = 0;
    const action: PinSpotAction = vi.fn(
      (_prev: PinFormState, formData: FormData) => {
        seen.push(
          Object.fromEntries(
            [...formData.entries()].map(([k, v]) => [
              k,
              typeof v === 'string' ? v : v.name,
            ]),
          ),
        );
        call += 1;
        const next: PinFormState =
          call === 1
            ? { status: 'place_searched', draft: DRAFT, places }
            : {
                status: 'located',
                draft: {
                  ...DRAFT,
                  name: places[1].name,
                  address: places[1].address,
                },
                location: LOCATED.location,
              };
        return Promise.resolve(next);
      },
    );
    render(<PinSpotForm action={action} />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: '검색' }));
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /피롤츠 로스터리/ }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /피롤츠 로스터리/ }));

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    expect(seen[1]?.['pickPlace']).toBe('1');
    // 비제어 입력이라도 서버가 돌려준 값이 화면에 반영돼야 한다
    expect(screen.getByLabelText('가게 이름')).toHaveValue('피롤츠 로스터리');
    expect(screen.getByLabelText('주소')).toHaveValue(
      '서울 용산구 한강대로 60',
    );
  });

  it('이름으로 못 찾으면 주소로 찾으라고 말한다 — 길이 끊기지 않는다', async () => {
    const user = userEvent.setup();
    const failed: PinFormState = {
      status: 'failed',
      draft: DRAFT,
      failure: { kind: 'place_not_found' },
    };
    render(<PinSpotForm action={recording(failed, [])} />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: '검색' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('주소를 직접 넣어');
    });
    expect(screen.getByLabelText('주소')).toBeInTheDocument();
  });

  it('이름만 넣어도 브라우저가 막지 않는다 — 이름 검색은 주소를 요구하지 않는다', async () => {
    const user = userEvent.setup();
    const seen: Record<string, string>[] = [];
    render(<PinSpotForm action={recording({ status: 'idle' }, seen)} />);

    await user.type(screen.getByLabelText('가게 이름'), '피롤츠 커피하우스');
    await user.click(screen.getByRole('button', { name: '검색' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(seen[0]).toMatchObject({ intent: 'search_place', address: '' });
  });

  it('주소만 넣어도 막지 않는다 — 주소로 찾고 이름은 나중에 붙인다', async () => {
    const user = userEvent.setup();
    const seen: Record<string, string>[] = [];
    render(<PinSpotForm action={recording({ status: 'idle' }, seen)} />);

    await user.type(screen.getByLabelText('주소'), '서울 용산구 한강대로 56-1');
    await user.click(screen.getByRole('button', { name: '주소 검색' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(seen[0]).toMatchObject({ intent: 'search', name: '' });
  });

  it('좌표는 확인됐는데 이름이 없으면, 저장을 누르기 전에 그 사실을 말한다', async () => {
    const user = userEvent.setup();
    const noName: PinFormState = {
      status: 'located',
      draft: { ...DRAFT, name: '' },
      location: LOCATED.location,
    };
    render(<PinSpotForm action={recording(noName, [])} />);

    await user.type(screen.getByLabelText('주소'), '서울 용산구 한강대로 56-1');
    await user.click(screen.getByRole('button', { name: '주소 검색' }));

    await waitFor(() => {
      expect(
        screen.getByText('저장하려면 위에 가게 이름을 적어 주세요'),
      ).toBeInTheDocument();
    });
  });

  it('저장 버튼은 intent=save와 함께 그때까지의 이름 · 주소를 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Record<string, string>[] = [];
    render(<PinSpotForm action={recording(LOCATED, seen)} />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: '주소 검색' }));
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: '이 위치로 저장' }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: '이 위치로 저장' }));

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    expect(seen[1]).toMatchObject({
      intent: 'save',
      name: DRAFT.name,
      address: DRAFT.address,
    });
  });

  it('처음에는 위치 찾기만 있고 저장 버튼은 없다 — 미리보기를 건너뛰고 저장할 수 없다', () => {
    render(<PinSpotForm action={recording({ status: 'idle' }, [])} />);
    expect(
      screen.getByRole('button', { name: '주소 검색' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '이 위치로 저장' }),
    ).not.toBeInTheDocument();
  });

  it('주소 검색은 intent=search로 이름 · 주소 · 카테고리를 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Record<string, string>[] = [];
    render(<PinSpotForm action={recording(LOCATED, seen)} />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: '주소 검색' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(seen[0]).toMatchObject({
      intent: 'search',
      name: DRAFT.name,
      address: DRAFT.address,
      category: 'cafe',
    });
  });

  it('후보가 여럿이면 목록을 보이고, 하나를 고르면 pick=<주소>가 실린다', async () => {
    const user = userEvent.setup();
    const seen: Record<string, string>[] = [];
    const searched: PinFormState = {
      status: 'searched',
      draft: DRAFT,
      candidates: [
        LOCATED.location,
        {
          ...LOCATED.location,
          roadAddress: '서울특별시 용산구 한강대로 56-2',
          jibunAddress: '',
        },
      ],
    };
    render(<PinSpotForm action={recording(searched, seen)} />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: '주소 검색' }));

    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: '주소 검색 결과' }),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: '이 위치로 저장' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /한강대로 56-2/ }));
    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    expect(seen[1]?.['pick']).toBe('서울특별시 용산구 한강대로 56-2');
  });

  it('좌표가 확인되면 미리보기와 정규화 주소, 저장 버튼이 나타난다', async () => {
    const user = userEvent.setup();
    render(<PinSpotForm action={recording(LOCATED, [])} />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: '주소 검색' }));

    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: '찾은 위치 미리보기' }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText('서울특별시 용산구 한강대로 56-1'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '이 위치로 저장' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '다시 검색' }),
    ).toBeInTheDocument();
  });

  it('저장 버튼은 intent=save를 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Record<string, string>[] = [];
    // 첫 제출은 located, 둘째는 저장(리다이렉트 대신 같은 상태를 돌려준다)
    render(<PinSpotForm action={recording(LOCATED, seen)} />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: '주소 검색' }));
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: '이 위치로 저장' }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: '이 위치로 저장' }));

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    expect(seen[1]?.['intent']).toBe('save');
  });

  it('주소를 못 찾으면 그 자리에서 다시 입력하라고 말하고 저장 버튼은 열지 않는다', async () => {
    const user = userEvent.setup();
    const failed: PinFormState = {
      status: 'failed',
      draft: DRAFT,
      failure: { kind: 'address_not_found' },
    };
    render(<PinSpotForm action={recording(failed, [])} />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: '주소 검색' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        '위치를 찾지 못했어요',
      );
    });
    expect(
      screen.queryByRole('button', { name: '이 위치로 저장' }),
    ).not.toBeInTheDocument();
  });

  it('저장소가 없으면 환경 변수 이름을 알려 준다', async () => {
    const user = userEvent.setup();
    const failed: PinFormState = {
      status: 'failed',
      draft: DRAFT,
      failure: { kind: 'store_unconfigured' },
    };
    render(<PinSpotForm action={recording(failed, [])} />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: '주소 검색' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('SUPABASE_URL');
    });
  });
});
