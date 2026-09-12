import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_IMAGE_BYTES } from '@/domain/extraction';
/**
 * `useRouter`는 앱 라우터 컨텍스트를 요구한다 — jsdom에는 없어서 'invariant
 * expected app router to be mounted'로 죽는다. 이 컴포넌트가 라우터를 쓰는 것은
 * 추출이 끝난 뒤 결과 화면으로 넘기기 위한 한 줄뿐이라, 그 한 줄만 세운다.
 */
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { UploadForm } from './UploadForm';

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
  return screen.getByLabelText('스크린샷 파일 선택');
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
    render(<UploadForm />);

    // 파일 선택창은 jsdom에 없다. 확인할 수 있는 것은 버튼이 입력의 click을
    // 부른다는 것까지고, 그 뒤는 브라우저의 일이다.
    const click = vi.spyOn(picker(), 'click');
    await user.click(screen.getByRole('button', { name: '스크린샷 고르기' }));

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('고르기 전에는 아무것도 말하지 않는다', () => {
    render(<UploadForm />);

    expect(screen.queryByText(/장 선택됨/)).not.toBeInTheDocument();
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });

  it('고른 한 장의 썸네일과 파일명을 보여준다', async () => {
    const user = userEvent.setup();
    render(<UploadForm />);

    await user.upload(picker(), [screenshot('pirouettes.png')]);

    expect(screen.getByText('1장 선택됨')).toBeInTheDocument();
    // alt는 파일명이다 — 썸네일만으로는 어느 스크린샷인지 소리로 알 수 없다.
    expect(screen.getByAltText('pirouettes.png')).toBeInTheDocument();
  });

  it('올리기 전에 뺄 수 있고, 뺀 장의 URL을 해제한다', async () => {
    const user = userEvent.setup();
    render(<UploadForm />);

    await user.upload(picker(), [screenshot('pirouettes.png')]);
    await user.click(
      screen.getByRole('button', { name: 'pirouettes.png 빼기' }),
    );

    expect(screen.queryByText(/장 선택됨/)).not.toBeInTheDocument();
    expect(revoke).toHaveBeenCalledWith(created[0]);
  });

  it('새로 고르면 앞의 장을 갈아 끼우고 그 URL을 해제한다', async () => {
    const user = userEvent.setup();
    render(<UploadForm />);

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
    render(<UploadForm />);

    expect(picker()).not.toHaveAttribute('multiple');
  });

  it('StrictMode에서도 URL을 한 번만 만든다', async () => {
    const user = userEvent.setup();
    // `reactStrictMode: true`가 켜져 있어 개발 중 state 업데이터가 두 번
    // 호출된다. 업데이터 안에서 createObjectURL을 부르면 URL이 새고, 그 누수는
    // 화면에 아무 증상도 남기지 않는다.
    render(
      <StrictMode>
        <UploadForm />
      </StrictMode>,
    );

    await user.upload(picker(), [screenshot('pirouettes.png')]);

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('화면을 떠날 때 남은 URL을 해제한다', async () => {
    const user = userEvent.setup();
    const view = render(<UploadForm />);

    await user.upload(picker(), [screenshot('pirouettes.png')]);
    view.unmount();

    expect(revoke).toHaveBeenCalledWith(created[0]);
  });
});

describe('UploadForm — 가드', () => {
  it('막은 건을 조용히 버리지 않고 무엇이 왜 막혔는지 보여준다', () => {
    render(<UploadForm />);

    chooseIgnoringAccept([
      new File(['x'], 'note.pdf', { type: 'application/pdf' }),
    ]);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('올릴 수 없는 스크린샷입니다');
    expect(alert).toHaveTextContent('note.pdf');
    expect(alert).toHaveTextContent('읽을 수 없는 형식입니다');
    expect(screen.queryByText(/장 선택됨/)).not.toBeInTheDocument();
  });

  it('용량 상한을 넘으면 실제 크기와 상한을 함께 말한다', async () => {
    const user = userEvent.setup();
    render(<UploadForm />);

    await user.upload(picker(), [sized('huge.png', MAX_IMAGE_BYTES + 1)]);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('huge.png');
    expect(alert).toHaveTextContent('장당 상한 10.0MB를 넘습니다');
    expect(screen.queryByText(/장 선택됨/)).not.toBeInTheDocument();
  });

  it('여러 장이 들어오면 첫 장만 든다 — 멀티 업로드를 지원하지 않는다', () => {
    render(<UploadForm />);

    // 선택창에서 multiple을 뺐어도 드래그 앤 드롭이나 공유하기로 여러 장이
    // 들어올 수 있다. 뒤쪽 장은 보지 않는다.
    chooseIgnoringAccept([screenshot('a.png', 1), screenshot('b.png', 2)]);

    expect(screen.getByText('1장 선택됨')).toBeInTheDocument();
    expect(screen.getByAltText('a.png')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('다음 선택이 깨끗하면 앞선 경고가 남지 않는다', () => {
    render(<UploadForm />);

    chooseIgnoringAccept([
      new File(['x'], 'note.pdf', { type: 'application/pdf' }),
    ]);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    chooseIgnoringAccept([screenshot('ok.png')]);

    // 방금 고친 것이 여전히 문제인 것처럼 남으면 사용자가 무엇을 봐야 할지 모른다.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('선택창이 가드와 같은 형식만 보여준다', () => {
    render(<UploadForm />);

    // 선택창에서는 보이는데 고르면 막히는 파일이 있으면 앱이 고장난 줄 안다.
    expect(picker()).toHaveAttribute(
      'accept',
      'image/png,image/jpeg,image/webp',
    );
  });
});
