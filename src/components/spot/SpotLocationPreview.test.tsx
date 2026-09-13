import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { LocateAddressResult } from '@/domain/spot';
import { SpotLocationPreview } from './SpotLocationPreview';

vi.mock('../SpotMap', () => ({
  SpotMap: ({
    latitude,
    longitude,
    placeName,
  }: {
    latitude: number;
    longitude: number;
    placeName: string;
  }) => (
    <div role="application" aria-label={`${placeName} 위치 지도`}>
      {latitude}, {longitude}
    </div>
  ),
}));

const LOCATION: LocateAddressResult = {
  kind: 'ready',
  location: {
    coordinates: { latitude: 37.5299, longitude: 126.9648 },
    roadAddress: '서울 용산구 한강대로 56-1',
    jibunAddress: '',
    region: { sido: '서울특별시', sigugun: '용산구' },
  },
};

describe('SpotLocationPreview', () => {
  it('좌표가 올 때까지 로딩을 보여주고 확인한 좌표에 핀을 놓는다', async () => {
    const pending = Promise.withResolvers<LocateAddressResult>();
    const locate = vi.fn().mockReturnValue(pending.promise);
    render(
      <SpotLocationPreview
        name="피롤츠"
        address="한강대로 56-1"
        locate={locate}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      '핀 위치를 찾고 있습니다',
    );
    expect(screen.queryByRole('application')).not.toBeInTheDocument();
    expect(locate).toHaveBeenCalledWith('한강대로 56-1');

    await act(async () => {
      pending.resolve(LOCATION);
      await pending.promise;
    });
    expect(
      screen.getByRole('application', { name: '피롤츠 위치 지도' }),
    ).toHaveTextContent('37.5299, 126.9648');
  });

  it('찾지 못한 주소에는 임의의 핀을 표시하지 않는다', async () => {
    const locate = vi.fn().mockResolvedValue({ kind: 'not_found' });
    render(
      <SpotLocationPreview name="피롤츠" address="없는 주소" locate={locate} />,
    );

    expect(
      await screen.findByText(/이 주소의 위치를 찾지 못했어요/),
    ).toBeVisible();
    expect(screen.queryByRole('application')).not.toBeInTheDocument();
  });

  it.each(['unavailable', 'rejected'])(
    '조회 실패(%s) 뒤 다시 확인할 수 있다',
    async failure => {
      const user = userEvent.setup();
      const locate = vi.fn();
      if (failure === 'rejected')
        locate.mockRejectedValueOnce(new Error('network'));
      else
        locate.mockResolvedValueOnce({ kind: 'unavailable', reason: 'http' });
      locate.mockResolvedValueOnce(LOCATION);
      render(
        <SpotLocationPreview
          name="피롤츠"
          address="한강대로 56-1"
          locate={locate}
        />,
      );

      await user.click(
        await screen.findByRole('button', { name: '위치 다시 확인' }),
      );

      expect(await screen.findByRole('application')).toHaveTextContent(
        '37.5299, 126.9648',
      );
      expect(locate).toHaveBeenCalledTimes(2);
    },
  );

  it('주소 변경 전의 늦은 응답으로 새 핀을 덮어쓰지 않는다', async () => {
    const oldRequest = Promise.withResolvers<LocateAddressResult>();
    const locate = vi
      .fn()
      .mockReturnValueOnce(oldRequest.promise)
      .mockResolvedValueOnce(LOCATION);
    const { rerender } = render(
      <SpotLocationPreview name="피롤츠" address="이전 주소" locate={locate} />,
    );

    rerender(
      <SpotLocationPreview name="피롤츠" address="새 주소" locate={locate} />,
    );
    await screen.findByRole('application');
    await act(async () => {
      oldRequest.resolve({ kind: 'not_found' });
      await oldRequest.promise;
    });

    expect(screen.getByRole('application')).toHaveTextContent(
      '37.5299, 126.9648',
    );
    expect(
      screen.queryByText(/이 주소의 위치를 찾지 못했어요/),
    ).not.toBeInTheDocument();
  });
});
