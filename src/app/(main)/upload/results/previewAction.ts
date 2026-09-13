'use server';

import { locateAddress } from '@/domain/spot';
import type { LocateAddressResult } from '@/domain/spot';

/** 저장 없이 수동 핀찍기와 같은 주소 검증으로 미리보기 좌표만 구한다. */
export async function previewSpotLocationAction(
  address: string,
): Promise<LocateAddressResult> {
  if (typeof address !== 'string' || address.trim().length === 0) {
    return { kind: 'not_found' };
  }
  return locateAddress(address.trim());
}
