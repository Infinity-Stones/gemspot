import { StrictMode } from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtractState } from '@/app/upload/extractState';
import { IDLE_EXTRACT_STATE } from '@/app/upload/extractState';
import type { ExtractFailureReason } from '@/domain/extraction';
import { MAX_IMAGE_BYTES, MAX_IMAGE_COUNT } from '@/domain/extraction';
import { SPOT_NEW_PATH } from '@/shared/routes';
/**
 * `useRouter`는 앱 라우터 컨텍스트를 요구한다 — jsdom에는 없어서 'invariant
 * expected app router to be mounted'로 죽는다. 이 컴포넌트가 라우터를 쓰는 것은
 * 추출이 끝난 뒤 결과 화면으로 넘기기 위한 한 줄뿐이라, 그 한 줄만 세운다.
 */
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { UploadForm } from './UploadForm';
import type { ExtractAction } from './UploadForm';

/**
 * 제출까지 가지 않는 테스트에 꽂는 액션. 서버 액션은 jsdom에서 돌지 않으므로
 * 이 컴포넌트는 액션을 prop으로 받는다.
 */
function idleAction(): ExtractAction {
  return vi.fn(() => Promise.resolve(IDLE_EXTRACT_STATE));
}

/** 제출할 때마다 같은 실패를 돌려주는 액션. */
function failingAction(reason: ExtractFailureReason): ExtractAction {
  const failed: ExtractState = { status: 'failed', reason };
  return vi.fn(() => Promise.resolve(failed));
}

/** 같은 실패를 돌려주되, 제출마다 폼에 실려 온 파일명을 적어 둔다. */
function recordingFailure(
  reason: ExtractFailureReason,
  seen: string[],
): ExtractAction {
  const failed: ExtractState = { status: 'failed', reason };
  return vi.fn((_previous: ExtractState, formData: FormData) => {
    const file = formData.get('image');
    seen.push(file instanceof File ? file.name : '(없음)');
    return Promise.resolve(failed);
  });
}

function screenshot(name: string, lastModified = 1_757_289_600_000) {
  return new File(['x'], name, { type: 'image/png', lastModified });
}

/**
 * 크기를 지정한 파일. `File`의 `size`는 읽기 전용이고 내용에서 계산되므로,
 * 상한을 넘기려면 그만큼의 바이트를 실제로 담아야 한다.
 */
function sized(name: string, bytes: number) {
  return new File([new Uint8Array(bytes)], name, { type: 'image/png' });
}

function picker() {
  return screen.getByLabelText<HTMLInputElement>('스크린샷 파일 선택');
}

/**
 * 선택창의 `accept`를 무시하고 파일을 넣는다.
 *
 * `userEvent.upload`는 accept 속성에 맞는 파일만 통과시키고, 이 버전에는 그
 * 필터를 끄는 옵션이 없다. 그런데 가드가 막아야 하는 것은 정확히 **accept를
 * 통과하지 못한 파일이 들어온 경우**다 — 사용자가 선택창에서 "모든 파일"로
 * 바꾸면 실제로 그렇게 들어온다. userEvent로는 그 상황을 만들 수 없어서
 * 브라우저가 하는 일(files를 채우고 change를 쏜다)을 직접 한다.
 */
function chooseIgnoringAccept(files: readonly File[]) {
  // 배열을 그대로 넣으면 안 된다. `input.files`는 FileList라 `item()`과 숫자
  // 인덱스를 가지고, userEvent가 나중에 같은 입력을 만지면 `item is not a
  // function`으로 죽는다.
  const list: Record<number, File> & {
    length: number;
    item: (index: number) => File | null;
  } = {
    length: files.length,
    item: index => files[index] ?? null,
  };
  files.forEach((file, index) => {
    list[index] = file;
  });

  const input = picker();
  Object.defineProperty(input, 'files', {
    value: list,
    configurable: true,
    writable: true,
  });
  fireEvent.change(input);
}

/**
 * jsdom은 `createObjectURL`·`revokeObjectURL`을 구현하지 않는다. 스텁을 두는
 * 이유는 미리보기를 보는 것뿐 아니라 **해제가 짝을 맞추는지** 세기 위해서다 —
 * 그게 이 컴포넌트에서 조용히 새는 유일한 자원이다.
 *
 * 목을 지역 변수로 들고 단언한다. `URL.revokeObjectURL`을 그대로 expect에
 * 넘기면 메서드를 객체에서 떼어내는 것이라 `unbound-method`가 막는다.
 */
const created: string[] = [];
const revoke = vi.fn<(url: string) => void>();
const create = vi.fn<(blob: Blob) => string>(() => {
  const url = `blob:screenshot-${String(created.length)}`;
  created.push(url);
  return url;
});

beforeEach(() => {
  push.mockClear();
  created.length = 0;
  create.mockClear();
  revoke.mockClear();
  URL.createObjectURL = create;
  URL.revokeObjectURL = revoke;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('UploadForm', () => {
  it('버튼이 감춰진 파일 입력을 대신 누른다', async () => {
    const user = userEvent.setup();
    render(<UploadForm action={idleAction()} />);

    // 파일 선택창은 jsdom에 없다. 확인할 수 있는 것은 버튼이 입력의 click을
    // 부른다는 것까지고, 그 뒤는 브라우저의 일이다.
    const click = vi.spyOn(picker(), 'click');
    await user.click(screen.getByRole('button', { name: '스크린샷 고르기' }));

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('고르기 전에는 아무것도 말하지 않는다', () => {
    render(<UploadForm action={idleAction()} />);

    expect(screen.queryByText(/장 선택됨/)).not.toBeInTheDocument();
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });

  it('고른 한 장의 썸네일과 파일명을 보여준다', async () => {
    const user = userEvent.setup();
    render(<UploadForm action={idleAction()} />);

    await user.upload(picker(), [screenshot('pirouettes.png')]);

    expect(screen.getByText('1장 선택됨')).toBeInTheDocument();
    // alt는 파일명이다 — 썸네일만으로는 어느 스크린샷인지 소리로 알 수 없다.
    expect(screen.getByAltText('pirouettes.png')).toBeInTheDocument();
  });

  it('올리기 전에 뺄 수 있고, 뺀 장의 URL을 해제한다', async () => {
    const user = userEvent.setup();
    render(<UploadForm action={idleAction()} />);

    await user.upload(picker(), [screenshot('pirouettes.png')]);
    await user.click(
      screen.getByRole('button', { name: 'pirouettes.png 빼기' }),
    );

    expect(screen.queryByText(/장 선택됨/)).not.toBeInTheDocument();
    expect(revoke).toHaveBeenCalledWith(created[0]);
  });

  it('새로 고르면 앞의 장을 갈아 끼우고 그 URL을 해제한다', async () => {
    const user = userEvent.setup();
    render(<UploadForm action={idleAction()} />);

    await user.upload(picker(), [screenshot('pirouettes.png')]);
    await user.upload(picker(), [screenshot('fabri.png')]);

    // 명세가 여러 장 선택을 두지 않으므로 쌓이지 않는다.
    expect(screen.getByText('1장 선택됨')).toBeInTheDocument();
    expect(screen.getByAltText('fabri.png')).toBeInTheDocument();
    expect(screen.queryByAltText('pirouettes.png')).not.toBeInTheDocument();
    // 갈아 끼우면서 앞의 URL을 놓치면 화면에 아무 증상 없이 새어 나간다.
    expect(revoke).toHaveBeenCalledWith(created[0]);
  });

  it('한 장만 받도록 선택창이 열려 있다', () => {
    render(<UploadForm action={idleAction()} />);

    expect(picker()).not.toHaveAttribute('multiple');
  });

  it('StrictMode에서도 URL을 한 번만 만든다', async () => {
    const user = userEvent.setup();
    // `reactStrictMode: true`가 켜져 있어 개발 중 state 업데이터가 두 번
    // 호출된다. 업데이터 안에서 createObjectURL을 부르면 URL이 새고, 그 누수는
    // 화면에 아무 증상도 남기지 않는다.
    render(
      <StrictMode>
        <UploadForm action={idleAction()} />
      </StrictMode>,
    );

    await user.upload(picker(), [screenshot('pirouettes.png')]);

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('화면을 떠날 때 남은 URL을 해제한다', async () => {
    const user = userEvent.setup();
    const view = render(<UploadForm action={idleAction()} />);

    await user.upload(picker(), [screenshot('pirouettes.png')]);
    view.unmount();

    expect(revoke).toHaveBeenCalledWith(created[0]);
  });
});

describe('UploadForm — 가드', () => {
  it('막은 건을 조용히 버리지 않고 무엇이 왜 막혔는지 보여준다', () => {
    render(<UploadForm action={idleAction()} />);

    chooseIgnoringAccept([
      screenshot('ok.png'),
      new File(['x'], 'note.pdf', { type: 'application/pdf' }),
    ]);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('1장을 올릴 수 없습니다');
    expect(alert).toHaveTextContent('note.pdf');
    expect(alert).toHaveTextContent('읽을 수 없는 형식입니다');
    // 통과한 장은 그대로 담긴다 — 한 장이 막혀도 나머지를 버리지 않는다.
    expect(screen.getByText('1장 선택됨')).toBeInTheDocument();
  });

  it('용량 상한을 넘으면 실제 크기와 상한을 함께 말한다', async () => {
    const user = userEvent.setup();
    render(<UploadForm action={idleAction()} />);

    await user.upload(picker(), [sized('huge.png', MAX_IMAGE_BYTES + 1)]);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('huge.png');
    expect(alert).toHaveTextContent('장당 상한 10.0MB를 넘습니다');
    expect(screen.queryByText(/장 선택됨/)).not.toBeInTheDocument();
  });

  it('한 장을 넘겨 고르면 넘은 장을 이유와 함께 막는다', () => {
    render(<UploadForm action={idleAction()} />);

    // 선택창에서 multiple을 뺐어도 드래그 앤 드롭이나 공유하기로 여러 장이
    // 들어올 수 있다. 그때 조용히 버리지 않아야 한다.
    chooseIgnoringAccept([screenshot('a.png', 1), screenshot('b.png', 2)]);

    expect(screen.getByText('1장 선택됨')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      `한 번에 ${String(MAX_IMAGE_COUNT)}장까지 올릴 수 있습니다`,
    );
  });

  it('다음 선택이 깨끗하면 앞선 경고가 남지 않는다', () => {
    render(<UploadForm action={idleAction()} />);

    chooseIgnoringAccept([
      new File(['x'], 'note.pdf', { type: 'application/pdf' }),
    ]);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    chooseIgnoringAccept([screenshot('ok.png')]);

    // 방금 고친 것이 여전히 문제인 것처럼 남으면 사용자가 무엇을 봐야 할지 모른다.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('선택창이 가드와 같은 형식만 보여준다', () => {
    render(<UploadForm action={idleAction()} />);

    // 선택창에서는 보이는데 고르면 막히는 파일이 있으면 앱이 고장난 줄 안다.
    expect(picker()).toHaveAttribute(
      'accept',
      'image/png,image/jpeg,image/webp',
    );
  });
});

/**
 * 한 장을 고르고 보내 실패를 받은 자리까지 간다. 폴백은 그 뒤의 이야기다.
 */
async function failOnce(
  user: ReturnType<typeof userEvent.setup>,
  name = 'pirouettes.png',
) {
  await user.upload(picker(), [screenshot(name)]);
  await user.click(screen.getByRole('button', { name: '주소 읽기' }));
  await waitFor(() => {
    expect(screen.getByText('추출하지 못했습니다')).toBeInTheDocument();
  });
}

/**
 * 읽지 못했을 때 사용자가 할 수 있는 일은 둘이다 — 다시 보내거나, 주소를 알면
 * 직접 핀을 찍거나. 문구만 남기고 끝내면 사용자는 막다른 화면에 선다.
 */
describe('UploadForm — 실패 폴백', () => {
  it('읽지 못하면 다시 시도와 직접 입력을 함께 내민다', async () => {
    const user = userEvent.setup();
    render(<UploadForm action={failingAction('network')} />);

    await failOnce(user);

    expect(
      screen.getByRole('button', { name: '다시 시도' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /직접 핀 찍기/ })).toHaveAttribute(
      'href',
      SPOT_NEW_PATH,
    );
  });

  it('다시 시도는 고른 장을 그대로 다시 보낸다', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    render(<UploadForm action={recordingFailure('timeout', seen)} />);

    await failOnce(user, 'fabri.png');
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });

    // 사진을 다시 고르게 하지 않는다 — 실패의 원인이 사진에 있었던 적은 없다.
    // 두 번째가 비면 React가 폼 액션 뒤에 폼을 초기화한 것을 다시 읽고 있다는
    // 뜻이다. 보낼 것은 입력이 아니라 상태에 담긴 File이어야 한다.
    expect(seen).toEqual(['fabri.png', 'fabri.png']);
    expect(screen.getByAltText('fabri.png')).toBeInTheDocument();
  });

  it('재시도를 내미는 동안 같은 일을 하는 아래 제출 버튼은 감춘다', async () => {
    const user = userEvent.setup();
    render(<UploadForm action={failingAction('parse')} />);

    await failOnce(user);

    expect(
      screen.queryByRole('button', { name: '주소 읽기' }),
    ).not.toBeInTheDocument();
  });

  it('키가 없으면 재시도 대신 직접 입력만 내민다', async () => {
    const user = userEvent.setup();
    render(<UploadForm action={failingAction('no_api_key')} />);

    await failOnce(user);

    // 배포 환경의 상태라 몇 번을 눌러도 같은 답이 온다. 되지 않을 일을 해
    // 보라고 말하면 사용자는 자기가 무언가를 잘못한 줄 안다.
    expect(
      screen.queryByRole('button', { name: '다시 시도' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /직접 핀 찍기/ }),
    ).toBeInTheDocument();
    // 대신 아래의 제출 버튼은 남긴다. 다른 장을 골라 보낼 길까지 막지 않는다.
    expect(
      screen.getByRole('button', { name: '주소 읽기' }),
    ).toBeInTheDocument();
  });

  it('실패를 읽어 주는 영역에 누를 것을 섞지 않는다', async () => {
    const user = userEvent.setup();
    render(<UploadForm action={failingAction('parse')} />);

    await failOnce(user);

    // role="alert"는 내용이 바뀔 때마다 통째로 읽힌다. 버튼과 링크가 그 안에
    // 있으면 누를 것이 낭독에 섞여 되풀이된다.
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('추출 결과를 읽지 못했습니다');
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument();
    expect(within(alert).queryByRole('link')).not.toBeInTheDocument();
  });
});
