const { loadConfig } = require('../../state-reporter/config');

describe('state-reporter config', () => {
  test('uses defaults', () => {
    expect(loadConfig({})).toStrictEqual({
      openhab: {
        host: '127.0.0.1',
        port: 8080,
        path: '/rest/items/',
        url: 'http://127.0.0.1:8080'
      },
      agentUserId: 'openhab-home',
      debounceMs: 1000
    });
  });

  test('uses LOCAL_* and AGENT_USER_ID environment values', () => {
    expect(
      loadConfig({
        LOCAL_OPENHAB_URL: 'https://openhab.example:8443/',
        AGENT_USER_ID: 'house-1',
        REPORT_STATE_DEBOUNCE_MS: '1500'
      })
    ).toStrictEqual({
      openhab: {
        host: 'openhab.example',
        port: 8443,
        path: '/rest/items/',
        url: 'https://openhab.example:8443'
      },
      agentUserId: 'house-1',
      debounceMs: 1500
    });
  });

  test('defaults https to port 443', () => {
    expect(loadConfig({ LOCAL_OPENHAB_URL: 'https://openhab.example' }).openhab.port).toBe(443);
  });

  test('rejects a non-http LOCAL_OPENHAB_URL', () => {
    expect(() => loadConfig({ LOCAL_OPENHAB_URL: 'ftp://127.0.0.1' })).toThrow('http or https');
  });

  test('rejects an invalid LOCAL_OPENHAB_URL', () => {
    expect(() => loadConfig({ LOCAL_OPENHAB_URL: 'not-a-url' })).toThrow('valid URL');
  });

  test('rejects an invalid REPORT_STATE_DEBOUNCE_MS', () => {
    expect(() => loadConfig({ REPORT_STATE_DEBOUNCE_MS: '0' })).toThrow('REPORT_STATE_DEBOUNCE_MS');
  });

  test('includes LOCAL_OPENHAB_USERPASS when it is a non-empty string', () => {
    expect(loadConfig({ LOCAL_OPENHAB_USERPASS: 'user:secret' }).openhab.userpass).toBe('user:secret');
  });

  test('omits LOCAL_OPENHAB_USERPASS when it is empty', () => {
    expect(loadConfig({ LOCAL_OPENHAB_USERPASS: '' }).openhab.userpass).toBeUndefined();
  });
});
