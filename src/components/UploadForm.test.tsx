import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UploadForm } from './UploadForm';

function screenshot(name: string, lastModified = 1_757_289_600_000) {
  return new File(['x'], name, { type: 'image/png', lastModified });
}

function picker() {
  return screen.getByLabelText('스크린샷 파일 선택');
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

  it('여러 장을 한 번에 받고 장수와 썸네일을 보여준다', async () => {
    const user = userEvent.setup();
    render(<UploadForm />);

    await user.upload(picker(), [
      screenshot('pirouettes.png'),
      screenshot('fabri.png'),
    ]);

    expect(screen.getByText('2장 선택됨')).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(2);
    // alt는 파일명이다 — 썸네일만으로는 어느 스크린샷인지 소리로 알 수 없다.
    expect(screen.getByAltText('pirouettes.png')).toBeInTheDocument();
  });

  it('올리기 전에 개별로 뺄 수 있고, 뺀 장의 URL을 해제한다', async () => {
    const user = userEvent.setup();
    render(<UploadForm />);

    await user.upload(picker(), [
      screenshot('pirouettes.png'),
      screenshot('fabri.png'),
    ]);
    await user.click(
      screen.getByRole('button', { name: 'pirouettes.png 빼기' }),
    );

    expect(screen.getByText('1장 선택됨')).toBeInTheDocument();
    expect(screen.queryByAltText('pirouettes.png')).not.toBeInTheDocument();
    expect(screen.getByAltText('fabri.png')).toBeInTheDocument();
    expect(revoke).toHaveBeenCalledWith(created[0]);
  });

  it('두 번에 나눠 고르면 앞에 고른 장이 남는다', async () => {
    const user = userEvent.setup();
    render(<UploadForm />);

    await user.upload(picker(), [screenshot('pirouettes.png')]);
    await user.upload(picker(), [screenshot('fabri.png')]);

    expect(screen.getByText('2장 선택됨')).toBeInTheDocument();
  });

  it('같은 파일을 두 번 고르면 한 장으로 본다', async () => {
    const user = userEvent.setup();
    render(<UploadForm />);

    // 같은 스크린샷을 또 고르는 일은 흔하다. 중복을 두면 OCR을 두 번 부르고
    // STEP 3에 같은 건이 두 줄로 뜬다.
    await user.upload(picker(), [screenshot('pirouettes.png')]);
    await user.upload(picker(), [screenshot('pirouettes.png')]);

    expect(screen.getByText('1장 선택됨')).toBeInTheDocument();
  });

  it('이름이 같아도 수정 시각이 다르면 다른 파일로 본다', async () => {
    const user = userEvent.setup();
    render(<UploadForm />);

    await user.upload(picker(), [screenshot('IMG_0001.png', 1)]);
    await user.upload(picker(), [screenshot('IMG_0001.png', 2)]);

    expect(screen.getByText('2장 선택됨')).toBeInTheDocument();
  });

  it('StrictMode에서도 장마다 URL을 한 번만 만든다', async () => {
    const user = userEvent.setup();
    // `reactStrictMode: true`가 켜져 있어 개발 중 state 업데이터가 두 번
    // 호출된다. 업데이터 안에서 createObjectURL을 부르면 장마다 URL이 하나씩
    // 새고, 그 누수는 화면에 아무 증상도 남기지 않는다.
    render(
      <StrictMode>
        <UploadForm />
      </StrictMode>,
    );

    await user.upload(picker(), [
      screenshot('pirouettes.png'),
      screenshot('fabri.png'),
    ]);

    expect(create).toHaveBeenCalledTimes(2);
  });

  it('화면을 떠날 때 남은 URL을 전부 해제한다', async () => {
    const user = userEvent.setup();
    const view = render(<UploadForm />);

    await user.upload(picker(), [
      screenshot('pirouettes.png'),
      screenshot('fabri.png'),
    ]);
    view.unmount();

    expect(revoke).toHaveBeenCalledWith(created[0]);
    expect(revoke).toHaveBeenCalledWith(created[1]);
  });
});
