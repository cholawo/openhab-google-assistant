const { listReachableDevices } = require('../../local-server/reachable');

describe('listReachableDevices', () => {
  test('includes locally eligible items and omits excluded or unprotected types', async () => {
    const apiHandler = {
      getItems: jest.fn().mockResolvedValue([
        {
          type: 'Switch',
          name: 'SwitchItem',
          metadata: { ga: { value: 'Switch' } }
        },
        {
          type: 'String',
          name: 'CameraItem',
          metadata: { ga: { value: 'Camera' } }
        },
        {
          type: 'Switch',
          name: 'PinSwitch',
          metadata: { ga: { value: 'Switch', config: { pinNeeded: '1234' } } }
        },
        {
          type: 'Number',
          name: 'NoGa'
        }
      ])
    };

    await expect(listReachableDevices(apiHandler)).resolves.toStrictEqual({
      devices: [{ verificationId: 'SwitchItem' }]
    });
    expect(apiHandler.getItems).toHaveBeenCalledTimes(1);
  });
});
