import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { supabaseSecretKey, supabaseUrl } from './env';

/**
 * Supabase 어댑터 — D06(#26)의 결정을 코드로. 이 파일이 `@supabase/supabase-js`를
 * 아는 유일한 곳이다.
 *
 * **서버 전용이다.** 시크릿 키로 붙으므로 RLS를 우회한다. 브라우저에 이 클라이언트가
 * 나가면 안 되고, 그래서 `NEXT_PUBLIC_` 변수를 읽지 않는다. 기본 1인 사용에
 * 인증이 없어 지금은 이 경로 하나로 충분하다 — 공유(B05)가 생겨 사용자마다
 * 행을 가르게 되면 그때 publishable 키 + RLS 정책 경로를 따로 연다.
 *
 * 키가 없으면 `null`이다. 던지지 않는 이유는 env.ts와 같다 — 저장소 없이도
 * 앱은 시드로 떠야 하고, "없을 때 무엇이 맞는가"는 도메인이 정한다.
 */

let cached: SupabaseClient | null | undefined;

export function supabaseClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = supabaseUrl();
  const key = supabaseSecretKey();
  if (url === null || key === null) {
    cached = null;
    return cached;
  }
  cached = createClient(url, key, {
    // 서버에서 요청마다 새 컨텍스트로 붙는다. 세션을 들고 있을 브라우저가 없다.
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** 한 테이블의 모든 행. 실패 모양을 여기서 접어 도메인이 Supabase 오류 객체를 모르게 한다. */
export type SelectAllResult =
  | { readonly ok: true; readonly rows: readonly unknown[] }
  | { readonly ok: false; readonly error: { readonly kind: 'unconfigured' } | { readonly kind: 'query'; readonly message: string } };

export async function selectAllRows(
  table: string,
  options: { readonly orderBy?: string; readonly ascending?: boolean; readonly client?: SupabaseClient | null } = {},
): Promise<SelectAllResult> {
  const client = options.client === undefined ? supabaseClient() : options.client;
  if (client === null) return { ok: false, error: { kind: 'unconfigured' } };

  let query = client.from(table).select('*');
  if (options.orderBy !== undefined) {
    query = query.order(options.orderBy, { ascending: options.ascending ?? true });
  }
  const { data, error } = await query;
  if (error !== null) return { ok: false, error: { kind: 'query', message: error.message } };
  return { ok: true, rows: Array.isArray(data) ? (data as unknown[]) : [] };
}
