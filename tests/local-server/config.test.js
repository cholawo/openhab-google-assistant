const { loadConfig } = require('../../local-server/config');

describe('local-server config', () => {
  test('uses defaults', () => {
    expect(loadConfig({})).toStrictEqual({
      port: 3002,
      openhab: {
        host: '127.0.0.1',
        port: 8080,
        path: '/rest/items/',
        url: 'http://127.0.0.1:8080'
      },
      mdnsName: 'openhab-google'
    });
  });

  test('uses LOCAL_* environment values', () => {
    expect(
      loadConfig({
        LOCAL_PORT: '3100',
        LOCAL_OPENHAB_URL: 'https://openhab.example:8443/',
        LOCAL_MDNS_NAME: 'openhab-hub'
      })
    ).toStrictEqual({
      port: 3100,
      openhab: {
        host: 'openhab.example',
        port: 8443,
        path: '/rest/items/',
        url: 'https://openhab.example:8443'
      },
      mdnsName: 'openhab-hub'
    });
  });

  test('rejects an invalid LOCAL_PORT', () => {
    expect(() => loadConfig({ LOCAL_PORT: '0' })).toThrow('LOCAL_PORT');
  });

  test('rejects a non-http LOCAL_OPENHAB_URL', () => {
    expect(() => loadConfig({ LOCAL_OPENHAB_URL: 'ftp://127.0.0.1' })).toThrow('http or https');
  });

  test('rejects an invalid LOCAL_OPENHAB_URL', () => {
    expect(() => loadConfig({ LOCAL_OPENHAB_URL: 'not-a-url' })).toThrow('valid URL');
  });

  test('includes LOCAL_OPENHAB_USERPASS when it is a non-empty string', () => {
    expect(loadConfig({ LOCAL_OPENHAB_USERPASS: 'user:secret' }).openhab.userpass).toBe('user:secret');
  });

  test('omits LOCAL_OPENHAB_USERPASS when it is empty', () => {
    expect(loadConfig({ LOCAL_OPENHAB_USERPASS: '' }).openhab.userpass).toBeUndefined();
  });

  test('omits LOCAL_OPENHAB_USERPASS when it is unset', () => {
    expect(loadConfig({}).openhab.userpass).toBeUndefined();
  });
});
