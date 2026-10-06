const { selectLanAddress } = require('../../local-server/mdns/lan-address');

describe('selectLanAddress', () => {
  test('prefers eth0 over other RFC1918 addresses', () => {
    expect(
      selectLanAddress({
        wlan0: [{ family: 'IPv4', address: '192.168.0.10', internal: false }],
        eth0: [{ family: 'IPv4', address: '192.168.0.117', internal: false }]
      })
    ).toStrictEqual({
      interfaceName: 'eth0',
      address: '192.168.0.117'
    });
  });

  test('skips docker, tailscale, and loopback interfaces', () => {
    expect(
      selectLanAddress({
        lo: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
        docker0: [{ family: 'IPv4', address: '172.17.0.1', internal: false }],
        tailscale0: [{ family: 'IPv4', address: '100.64.0.1', internal: false }],
        enp1s0: [{ family: 'IPv4', address: '10.0.0.5', internal: false }]
      })
    ).toStrictEqual({
      interfaceName: 'enp1s0',
      address: '10.0.0.5'
    });
  });

  test('throws when no LAN address is available', () => {
    expect(() =>
      selectLanAddress({
        lo: [{ family: 'IPv4', address: '127.0.0.1', internal: true }]
      })
    ).toThrow('No LAN IPv4 address found');
  });
});
