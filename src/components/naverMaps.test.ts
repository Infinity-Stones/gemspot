import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'naver');
  Reflect.deleteProperty(globalThis, 'navermap_authFailure');
  document.getElementById('naver-maps-sdk')?.remove();
});

describe('공유 지도 SDK 로더', () => {
  it('동시 요청은 하나의 script를 공유하고 실패한 script를 다시 받을 수 있다', async () => {
    vi.resetModules();
    const { loadNaverMaps } = await import('./naverMaps');
    const first = loadNaverMaps();
    const same = loadNaverMaps();
    expect(first).toBe(same);
    const rejected =
      expect(first).rejects.toThrow('지도를 불러오지 못했습니다');
    document
      .getElementById('naver-maps-sdk')
      ?.dispatchEvent(new Event('error'));
    await rejected;
    expect(document.getElementById('naver-maps-sdk')).toBeNull();
    const retry = loadNaverMaps();
    const maps = {};
    Object.assign(globalThis, { naver: { maps } });
    document.getElementById('naver-maps-sdk')?.dispatchEvent(new Event('load'));
    await expect(retry).resolves.toBe(maps);
  });
  it('SDK 로드 이후의 인증 실패도 알리고 구독을 정리한다', async () => {
    vi.resetModules();
    const { loadNaverMaps, subscribeNaverMapsAuthFailure } =
      await import('./naverMaps');
    const listener = vi.fn();
    const unsubscribe = subscribeNaverMapsAuthFailure(listener);
    const first = loadNaverMaps();
    Object.assign(globalThis, { naver: { maps: {} } });
    const firstScript = document.getElementById('naver-maps-sdk');
    firstScript?.dispatchEvent(new Event('load'));
    await first;
    const host = globalThis as { navermap_authFailure?: () => void };
    host.navermap_authFailure?.();
    expect(listener).toHaveBeenCalledOnce();
    const retry = loadNaverMaps();
    expect(document.getElementById('naver-maps-sdk')).not.toBe(firstScript);
    document.getElementById('naver-maps-sdk')?.dispatchEvent(new Event('load'));
    await retry;
    unsubscribe();
    host.navermap_authFailure?.();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('로드 완료 후 SDK가 사라지면 이전 인스턴스를 반환하지 않고 재시도할 수 있다', async () => {
    vi.resetModules();
    const { loadNaverMaps } = await import('./naverMaps');
    const first = loadNaverMaps();
    Object.assign(globalThis, { naver: { maps: {} } });
    const firstScript = document.getElementById('naver-maps-sdk');
    firstScript?.dispatchEvent(new Event('load'));
    await first;

    Reflect.deleteProperty(globalThis, 'naver');
    await expect(loadNaverMaps()).rejects.toThrow('지도 SDK를 사용할 수 없습니다');
    expect(document.getElementById('naver-maps-sdk')).toBeNull();

    const retry = loadNaverMaps();
    const maps = {};
    Object.assign(globalThis, { naver: { maps } });
    document.getElementById('naver-maps-sdk')?.dispatchEvent(new Event('load'));
    await expect(retry).resolves.toBe(maps);
  });
});
