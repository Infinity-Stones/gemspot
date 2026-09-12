import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UploadForm } from './UploadForm';

function screenshot(name: string) {
  return new File(['x'], name, { type: 'image/png' });
}

describe('UploadForm', () => {
  it('버튼이 감춰진 파일 입력을 대신 누른다', async () => {
    const user = userEvent.setup();
    render(<UploadForm />);

    // 파일 선택창은 jsdom에 없다. 확인할 수 있는 것은 버튼이 입력의 click을
    // 부른다는 것까지고, 그 뒤는 브라우저의 일이다.
    const input = screen.getByLabelText('스크린샷 파일 선택');
    const click = vi.spyOn(input, 'click');

    await user.click(screen.getByRole('button', { name: '스크린샷 고르기' }));

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('고르기 전에는 장수를 말하지 않는다', () => {
    render(<UploadForm />);

    expect(screen.queryByText(/장 선택됨/)).not.toBeInTheDocument();
  });

  it('고른 장수를 화면에 드러낸다', async () => {
    const user = userEvent.setup();
    render(<UploadForm />);

    await user.upload(screen.getByLabelText('스크린샷 파일 선택'), [
      screenshot('pirouettes.png'),
      screenshot('fabri.png'),
    ]);

    expect(screen.getByText('2장 선택됨')).toBeInTheDocument();
  });

  it('여러 장을 한 번에 받도록 열려 있다', () => {
    render(<UploadForm />);

    // STEP 3이 성공 건과 실패 건을 나눠 보여주는 전제가 여러 장이다.
    expect(screen.getByLabelText('스크린샷 파일 선택')).toHaveAttribute(
      'multiple',
    );
  });
});
