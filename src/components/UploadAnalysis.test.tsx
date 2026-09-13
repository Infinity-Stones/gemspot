import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploadAnalysisStatus } from './UploadAnalysis';

afterEach(() => vi.useRealTimers());

describe('UploadAnalysisStatus', () => {
  it('실제 경과 시간을 표시하고 30초가 지나면 긴 대기 안내로 바꾼다', () => {
    vi.useFakeTimers();
    render(<UploadAnalysisStatus />);

    act(() => {
      vi.advanceTimersByTime(29_000);
    });
    expect(screen.getByRole('timer')).toHaveTextContent('29초 경과');
    expect(screen.getByRole('status')).toHaveTextContent(
      '스크린샷 속 장소를 찾고 있어요',
    );
    // 경과 시간을 매초 낭독하지 않는다.
    expect(screen.getByRole('timer')).toHaveAttribute('aria-live', 'off');

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByRole('timer')).toHaveTextContent('30초 경과');
    expect(screen.getByRole('status')).toHaveTextContent(
      '분석이 계속 진행 중이에요',
    );
  });

  it('분석이 끝나면 타이머를 정리하고 다음 분석은 0초부터 시작한다', () => {
    vi.useFakeTimers();
    const first = render(<UploadAnalysisStatus />);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    first.unmount();

    expect(vi.getTimerCount()).toBe(0);
    render(<UploadAnalysisStatus />);
    expect(screen.getByRole('timer')).toHaveTextContent('0초 경과');
  });
});
