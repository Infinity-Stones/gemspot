import { beforeEach, describe, expect, it, vi } from 'vitest';
import { osmWalkingRoute } from './osmWalking';
import { walkingRoute as tmapWalkingRoute } from './tmap';
import { walkingRoute } from './walkingRoute';

vi.mock('./osmWalking', () => ({ osmWalkingRoute: vi.fn() }));
vi.mock('./tmap', () => ({ walkingRoute: vi.fn() }));

const FROM = { latitude: 37.5, longitude: 127 };
const TO = { latitude: 37.51, longitude: 127.01 };
const DATA = { distanceM: 441, durationS: 355, path: [FROM, TO] };

beforeEach(() => vi.resetAllMocks());

describe('보행 경로 제공자 선택', () => {
  it('OSM 성공이면 TMAP을 부르지 않는다', async () => {
    vi.mocked(osmWalkingRoute).mockResolvedValue({ ok: true, data: DATA });
    await expect(walkingRoute(FROM, TO)).resolves.toEqual({
      ok: true,
      data: DATA,
      source: 'osm',
    });
    expect(tmapWalkingRoute).not.toHaveBeenCalled();
  });

  it('OSM 실패이면 TMAP을 시도하고 실제 출처를 보존한다', async () => {
    vi.mocked(osmWalkingRoute).mockResolvedValue({
      ok: false,
      error: { kind: 'timeout', message: 'timeout' },
    });
    vi.mocked(tmapWalkingRoute).mockResolvedValue({ ok: true, data: DATA });
    await expect(walkingRoute(FROM, TO)).resolves.toEqual({
      ok: true,
      data: DATA,
      source: 'tmap',
    });
    expect(tmapWalkingRoute).toHaveBeenCalledWith(FROM, TO);
  });

  it('두 제공자 모두 실패하면 도메인이 추정할 수 있도록 실패를 돌려준다', async () => {
    vi.mocked(osmWalkingRoute).mockResolvedValue({
      ok: false,
      error: { kind: 'network', message: 'offline' },
    });
    vi.mocked(tmapWalkingRoute).mockResolvedValue({
      ok: false,
      error: { kind: 'no_app_key' },
    });
    await expect(walkingRoute(FROM, TO)).resolves.toMatchObject({ ok: false });
  });
});
