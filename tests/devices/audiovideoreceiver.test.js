const Device = require('../../functions/devices/audiovideoreceiver.js');

describe('AudioVideoReceiver Device', () => {
  test('matchesDeviceType', () => {
    expect(
      Device.matchesDeviceType({
        metadata: {
          ga: {
            value: 'AUDIO_VIDEO_RECEIVER'
          }
        }
      })
    ).toBe(false);
    expect(
      Device.matchesDeviceType({
        metadata: {
          ga: {
            value: 'AUDIO_VIDEO_RECEIVER'
          }
        },
        members: [
          {
            type: 'Switch',
            metadata: {
              ga: {
                value: 'tvPower'
              }
            }
          }
        ]
      })
    ).toBe(true);
  });

  test('type', () => {
    expect(Device.type).toBe('action.devices.types.AUDIO_VIDEO_RECEIVER');
  });

  test('getTraits excludes Channel when tvChannel member present', () => {
    const item = {
      members: [
        {
          state: '1',
          type: 'Number',
          metadata: {
            ga: {
              value: 'tvChannel'
            }
          }
        },
        {
          state: 'ON',
          type: 'Switch',
          metadata: {
            ga: {
              value: 'tvPower'
            }
          }
        }
      ]
    };
    expect(Device.getTraits(item)).not.toContain('action.devices.traits.Channel');
    expect(Device.getTraits(item)).toContain('action.devices.traits.OnOff');
  });

  test('getMetadata includes deviceType', () => {
    const metadata = Device.getMetadata({
      type: 'Group',
      name: 'AVRGroup',
      label: 'Surround Sound',
      metadata: { ga: { value: 'AUDIO_VIDEO_RECEIVER' } },
      members: [
        {
          name: 'avrPower',
          type: 'Switch',
          metadata: { ga: { value: 'tvPower' } }
        }
      ]
    });
    expect(metadata.customData.deviceType).toBe('AudioVideoReceiver');
    expect(metadata.type).toBe('action.devices.types.AUDIO_VIDEO_RECEIVER');
  });
});
