import { ApiError, NetworkError, TribuneClient } from './client';

type FetchSpy = jest.Mock<Promise<Response>, [RequestInfo, RequestInit?]>;

function makeResponse(status: number, body: unknown): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('TribuneClient', () => {
  let fetchSpy: FetchSpy;

  beforeEach(() => {
    fetchSpy = jest.fn();
    Object.assign(globalThis, { fetch: fetchSpy });
  });

  it('builds list URL with query params', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse(200, { disputes: [], total: 0, hasMore: false }));
    const client = new TribuneClient({ baseUrl: 'http://api.test' });
    await client.listDisputes({ status: 'SETTLED', limit: 10 });
    const calledUrl = (fetchSpy.mock.calls[0]![0] as string | URL).toString();
    expect(calledUrl).toContain('http://api.test/disputes?');
    expect(calledUrl).toContain('status=SETTLED');
    expect(calledUrl).toContain('limit=10');
  });

  it('serialises POST body and returns parsed JSON', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse(201, { id: 'abc', status: 'PENDING' }));
    const client = new TribuneClient({ baseUrl: 'http://api.test' });
    const body = await client.createDispute({
      claimantEns: 'a.b.eth',
      respondentEns: 'c.d.eth',
      claimType: 'service_not_delivered',
      statement: 'twenty characters at minimum here.',
      txHash: '0x' + 'a'.repeat(64),
      amountUsdc: 12,
    });
    expect(body.id).toBe('abc');
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual(
      expect.objectContaining({ claimantEns: 'a.b.eth' }),
    );
  });

  it('throws ApiError on non-2xx with parsed problem details', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse(400, {
        title: 'Validation failed',
        status: 400,
        detail: 'amountUsdc must be positive',
        errors: [{ path: 'amountUsdc', message: 'positive', code: 'too_small' }],
      }),
    );
    const client = new TribuneClient({ baseUrl: 'http://api.test' });
    await expect(client.getStats()).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Validation failed',
      detail: 'amountUsdc must be positive',
    });
  });

  it('throws NetworkError when fetch itself fails', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('fetch failed'));
    const client = new TribuneClient({ baseUrl: 'http://api.test' });
    await expect(client.getStats()).rejects.toBeInstanceOf(NetworkError);
  });

  it('streamUrl encodes the dispute id', () => {
    const client = new TribuneClient({ baseUrl: 'http://api.test' });
    expect(client.streamUrl('a/b c')).toBe('http://api.test/disputes/a%2Fb%20c/stream');
  });
});

describe('ApiError', () => {
  it('captures status and detail', () => {
    const err = new ApiError({ status: 500, message: 'Internal', detail: 'boom' });
    expect(err.status).toBe(500);
    expect(err.detail).toBe('boom');
    expect(err.name).toBe('ApiError');
  });
});
