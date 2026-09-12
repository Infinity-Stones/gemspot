import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeResponseSchema } from './openaiCompatible';
import { createGenerateJson } from './llm';
import { createReadSpotsFromImage } from './vision';

const config = {
  apiKey: 'test-key',
  baseUrl: 'https://provider.example/proxy/v1/',
  model: 'vision-model',
};
const input = {
  system: '기존 시스템 프롬프트',
  user: '기존 사용자 프롬프트',
  schema: { type: 'object' },
};
const image = { bytes: new Uint8Array([0, 128, 255]), mimeType: 'image/png' };

function mockResponse(raw: unknown) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(raw));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function completion(content: unknown) {
  return { choices: [{ message: { content }, finish_reason: 'stop' }] };
}

describe('OpenAI 호환 API 통합', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('env의 주소·키·모델과 기존 자연어 프롬프트·스키마를 보낸다', async () => {
    vi.stubEnv('OPENAI_BASE_URL', config.baseUrl);
    vi.stubEnv('OPENAI_API_KEY', config.apiKey);
    vi.stubEnv('OPENAI_MODEL', config.model);
    const fetchMock = mockResponse(completion('{"a":1}'));
    await expect(createGenerateJson()(input)).resolves.toEqual({
      ok: true,
      data: { a: 1 },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://provider.example/proxy/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer test-key',
          'content-type': 'application/json',
        }) as unknown,
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: input.system },
            { role: 'user', content: input.user },
          ],
          temperature: 0.2,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'gemspot_response',
              strict: true,
              schema: { ...input.schema, additionalProperties: false },
            },
          },
        }),
        signal: expect.any(AbortSignal) as unknown,
      }),
    );
  });

  it.each(['image/png', 'image/jpeg', 'image/webp'])(
    '이미지 %s와 기존 추출 프롬프트를 보내고 가게를 검증한다',
    async mimeType => {
      const fetchMock = mockResponse(
        completion(
          JSON.stringify({
            spots: [
              { name: ' 가게 ', address: ' 서울 ' },
              { name: 123, address: '' },
              { name: '', address: '' },
            ],
          }),
        ),
      );
      const result = await createReadSpotsFromImage(config)({
        ...image,
        mimeType,
      });
      expect(result).toEqual({
        ok: true,
        spots: [{ name: '가게', address: '서울' }],
      });
      const body = fetchMock.mock.calls[0]?.[1]?.body;
      expect(typeof body).toBe('string');
      if (typeof body !== 'string')
        throw new Error('요청 본문이 문자열이 아닙니다');
      const parsed: unknown = JSON.parse(body);
      expect(parsed).toMatchObject({
        model: config.model,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,AID/` },
              },
              {
                type: 'text',
                text: expect.stringContaining(
                  '화면에 보이는 글자를 그대로 적는다.',
                ) as unknown,
              },
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { schema: { required: ['spots'] } },
        },
      });
    },
  );

  it('가게가 없는 정상 이미지 응답은 빈 목록이다', async () => {
    mockResponse(completion('{"spots":[]}'));
    await expect(createReadSpotsFromImage(config)(image)).resolves.toEqual({
      ok: true,
      spots: [],
    });
  });

  it.each([401, 429, 500])(
    'HTTP %s를 두 호출 경로에서 상태 오류로 처리한다',
    async status => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response('secret upstream body', { status })),
      );
      for (const result of [
        await createGenerateJson(config)(input),
        await createReadSpotsFromImage(config)(image),
      ]) {
        expect(result).toMatchObject({
          ok: false,
          error: { kind: 'status', status },
        });
        expect(JSON.stringify(result)).not.toContain('secret');
      }
    },
  );

  it.each([
    {},
    null,
    { choices: [] },
    completion(null),
    completion(''),
    completion(123),
    completion('not json'),
    { choices: [{ message: { content: '{}' }, finish_reason: 'length' }] },
  ])('잘못된 응답을 성공으로 처리하지 않는다: %j', async raw => {
    mockResponse(raw);
    await expect(createGenerateJson(config)(input)).resolves.toMatchObject({
      ok: false,
      error: { kind: 'parse' },
    });
  });

  it('깨진 HTTP JSON 본문은 parse 오류다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response('not json')),
    );
    await expect(
      createReadSpotsFromImage(config)(image),
    ).resolves.toMatchObject({ ok: false, error: { kind: 'parse' } });
  });

  it.each(['TimeoutError', 'AbortError', 'TypeError'])(
    '%s를 시간 초과·통신 실패로 구분한다',
    async name => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn<typeof fetch>()
          .mockRejectedValue(Object.assign(new Error('failed'), { name })),
      );
      const kind = name === 'TypeError' ? 'network' : 'timeout';
      await expect(
        createReadSpotsFromImage(config)(image),
      ).resolves.toMatchObject({ ok: false, error: { kind } });
    },
  );

  it('응답 본문 수신 도중 시간 초과도 timeout이다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation((_url, init) =>
        Promise.resolve({
          ok: true,
          json: () =>
            new Promise((_resolve, reject) =>
              init?.signal?.addEventListener(
                'abort',
                () => reject(new DOMException('aborted', 'AbortError')),
                { once: true },
              ),
            ),
        } as Response),
      ),
    );
    await expect(
      createGenerateJson(config)({ ...input, timeoutMs: 5 }),
    ).resolves.toMatchObject({ ok: false, error: { kind: 'timeout' } });
  });

  it.each([
    null,
    '',
    'not-url',
    'ftp://provider.example',
    'https://user:pass@provider.example',
    'https://provider.example?key=x',
  ])('주소가 잘못되면 전송하지 않는다: %s', async baseUrl => {
    const fetchMock = mockResponse(completion('{}'));
    await expect(
      createGenerateJson({ ...config, baseUrl })(input),
    ).resolves.toMatchObject({ ok: false, error: { kind: 'network' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('키 또는 모델이 없으면 전송하지 않는다', async () => {
    const fetchMock = mockResponse(completion('{}'));
    await expect(
      createReadSpotsFromImage({ ...config, apiKey: null })(image),
    ).resolves.toMatchObject({ ok: false, error: { kind: 'no_api_key' } });
    await expect(
      createGenerateJson({ ...config, model: '' })(input),
    ).resolves.toMatchObject({ ok: false, error: { kind: 'network' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('구조화 출력의 중첩 객체', () => {
  it('배열과 null 허용 분기의 객체까지 닫고 원본은 바꾸지 않는다', () => {
    const object = {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    };
    const schema = {
      type: 'object',
      properties: {
        spots: { type: 'array', items: object },
        window: { anyOf: [object, { type: 'null' }] },
      },
      required: ['spots', 'window'],
    };
    const closed = { ...object, additionalProperties: false };
    expect(closeResponseSchema(schema)).toEqual({
      ...schema,
      additionalProperties: false,
      properties: {
        spots: { type: 'array', items: closed },
        window: { anyOf: [closed, { type: 'null' }] },
      },
    });
    expect(schema.properties.spots.items).not.toHaveProperty(
      'additionalProperties',
    );
  });
});
