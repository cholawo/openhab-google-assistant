const Device = require('../../functions/devices/default.js');
const config = require('../../functions/config.js');
const packageVersion = require('../../functions/package.json').version;

describe('Default Device', () => {
  const item = {
    type: 'Number',
    state: '50',
    name: 'DefaultDevice',
    label: 'Default Device',
    metadata: {
      ga: {
        value: '',
        config: {
          ackNeeded: true,
          checkState: true,
          inverted: true,
          pinNeeded: '1234',
          pinOnDisarmOnly: true,
          waitForStateChange: '5'
        }
      },
      synonyms: {
        value: 'Standard Device'
      }
    }
  };

  test('matchesItemType', () => {
    expect(Device.matchesItemType({ type: 'Number' })).toBe(true);
  });

  test('getConfig', () => {
    expect(Device.getConfig(item)).toStrictEqual({
      ackNeeded: true,
      checkState: true,
      inverted: true,
      pinNeeded: '1234',
      pinOnDisarmOnly: true,
      waitForStateChange: '5'
    });
  });

  test('getState', () => {
    expect(Device.getState(item)).toStrictEqual({});
  });

  test('getMetadata', () => {
    expect(Device.getMetadata(item)).toStrictEqual({
      attributes: {},
      customData: {
        ackNeeded: true,
        checkState: true,
        deviceType: 'DefaultDevice',
        inverted: true,
        itemType: 'Number',
        pinNeeded: '1234',
        pinOnDisarmOnly: true,
        waitForStateChange: 5
      },
      deviceInfo: {
        manufacturer: 'openHAB',
        model: 'Number:DefaultDevice',
        hwVersion: '3.0.0',
        swVersion: packageVersion
      },
      id: 'DefaultDevice',
      name: {
        defaultNames: ['Default Device'],
        name: 'Default Device',
        nicknames: ['Default Device', 'Standard Device']
      },
      roomHint: undefined,
      structureHint: undefined,
      traits: [],
      type: '',
      willReportState: false
    });
  });

  test('getMetadata legacy', () => {
    const metadata = Device.getMetadata({
      metadata: {
        ga: {
          config: {
            tfaAck: true,
            tfaPin: '1234'
          }
        }
      }
    });
    expect(metadata.customData.ackNeeded).toBe(true);
    expect(metadata.customData.pinNeeded).toBe('1234');
  });

  test('getMetadata locally controllable includes otherDeviceIds', () => {
    const Switch = require('../../functions/devices/switch.js');
    const metadata = Switch.getMetadata({
      type: 'Switch',
      name: 'LocalSwitch',
      label: 'Local Switch',
      metadata: { ga: { value: 'Switch' } }
    });
    expect(metadata.otherDeviceIds).toStrictEqual([{ deviceId: 'LocalSwitch' }]);
  });

  test('getMetadata switch omits otherDeviceIds when local fulfillment is off', () => {
    const Switch = require('../../functions/devices/switch.js');
    const original = config.localFulfillment;
    config.localFulfillment = false;
    try {
      const metadata = Switch.getMetadata({
        type: 'Switch',
        name: 'CloudSwitch',
        label: 'Cloud Switch',
        metadata: { ga: { value: 'Switch' } }
      });
      expect(metadata.otherDeviceIds).toBeUndefined();
    } finally {
      config.localFulfillment = original;
    }
  });

  test('getMetadata camera omits otherDeviceIds', () => {
    const Camera = require('../../functions/devices/camera.js');
    const metadata = Camera.getMetadata({
      type: 'String',
      name: 'CameraItem',
      label: 'Camera',
      metadata: { ga: { value: 'Camera' } }
    });
    expect(metadata.otherDeviceIds).toBeUndefined();
  });

  test('getMetadata no label fallback', () => {
    const metadata = Device.getMetadata({
      type: 'Number',
      state: '50',
      name: 'DefaultDevice'
    });
    expect(metadata.name.name).toBe('DefaultDevice');
  });
});
