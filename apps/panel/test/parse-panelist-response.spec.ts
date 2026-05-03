import { parsePanelistResponse } from '../src/domain/parse-panelist-response';

describe('parsePanelistResponse', () => {
  it('parses the documented JSON shape', () => {
    const out = parsePanelistResponse(
      JSON.stringify({ vote: 'REFUND', confidence: 0.92, reasoning: 'ok' }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.vote).toBe('REFUND');
      expect(out.confidence).toBe(0.92);
    }
  });

  it('extracts a JSON object even with leading prose', () => {
    const out = parsePanelistResponse(
      'Sure — here is my answer:\n{"vote":"REJECT","confidence":0.7,"reasoning":"fine"}',
    );
    expect(out.ok).toBe(true);
  });

  it('rejects responses with no JSON', () => {
    expect(parsePanelistResponse('I refuse to comply.')).toMatchObject({
      ok: false,
      errorCode: 'no_json',
    });
  });

  it('rejects schema mismatches', () => {
    expect(parsePanelistResponse('{"vote":"YES","confidence":0.9,"reasoning":"x"}')).toMatchObject({
      ok: false,
      errorCode: 'schema_mismatch',
    });
  });
});
