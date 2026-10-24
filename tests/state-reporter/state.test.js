const { buildDeviceState, deviceIdsForChangedItem, indexItems } = require('../../state-reporter/state');

describe('state-reporter state', () => {
  const switchItem = {
    type: 'Switch',
    name: 'SwitchItem',
    state: 'ON',
    metadata: { ga: { value: 'Switch' } }
  };
  const sceneItem = {
    type: 'Switch',
    name: 'SceneItem',
    state: 'OFF',
    metadata: { ga: { value: 'Scene' } }
  };
  const lightGroup = {
    type: 'Group',
    name: 'LightItem',
    state: 'NULL',
    metadata: { ga: { value: 'SpecialColorLight' } }
  };
  const lightColor = {
    type: 'Color',
    name: 'LightColor',
    state: '0,0,100',
    groupNames: ['LightItem'],
    metadata: { ga: { value: 'lightColor' } }
  };
  const lightPower = {
    type: 'Switch',
    name: 'LightPower',
    state: 'ON',
    groupNames: ['LightItem'],
    metadata: { ga: { value: 'lightPower' } }
  };

  test('buildDeviceState reports switch trait fields plus online', () => {
    expect(buildDeviceState(switchItem)).toStrictEqual({ online: true, on: true });
  });

  test('buildDeviceState skips Scene and other empty getState devices', () => {
    expect(buildDeviceState(sceneItem)).toBeNull();
  });

  test('buildDeviceState reports online false for NULL', () => {
    expect(buildDeviceState({ ...switchItem, state: 'NULL' })).toStrictEqual({ online: false });
  });

  test('buildDeviceState reports online false for UNDEF', () => {
    expect(buildDeviceState({ ...switchItem, state: 'UNDEF' })).toStrictEqual({ online: false });
  });

  test('buildDeviceState returns null when the item is not a Google device', () => {
    expect(buildDeviceState({ type: 'Switch', name: 'Plain', state: 'ON' })).toBeNull();
  });

  test('indexItems maps group members to the parent Google device', () => {
    const index = indexItems([switchItem, sceneItem, lightGroup, lightColor, lightPower]);
    expect([...index.devices.keys()]).toEqual(['SwitchItem', 'SceneItem', 'LightItem']);
    expect(index.parentsByMember.get('LightColor')).toEqual(['LightItem']);
    expect(index.parentsByMember.get('LightPower')).toEqual(['LightItem']);
    expect(index.devices.get('LightItem').members.map((member) => member.name)).toEqual(['LightColor', 'LightPower']);
  });

  test('deviceIdsForChangedItem includes the item and its parent group', () => {
    const index = indexItems([switchItem, lightGroup, lightColor, lightPower]);
    expect(deviceIdsForChangedItem('SwitchItem', index)).toEqual(['SwitchItem']);
    expect(deviceIdsForChangedItem('LightColor', index)).toEqual(['LightItem']);
    expect(deviceIdsForChangedItem('LightItem', index)).toEqual(['LightItem']);
    expect(deviceIdsForChangedItem('Unknown', index)).toEqual([]);
  });

  test('indexItems ignores group membership that is not a Google device', () => {
    const index = indexItems([
      switchItem,
      {
        type: 'Switch',
        name: 'Child',
        state: 'ON',
        groupNames: ['NotADevice', 'SwitchItem']
      }
    ]);
    expect(index.parentsByMember.get('Child')).toEqual(['SwitchItem']);
  });

  test('buildDeviceState uses group members for color lights', () => {
    const index = indexItems([lightGroup, lightColor, lightPower]);
    expect(buildDeviceState(index.devices.get('LightItem'))).toMatchObject({
      online: true,
      on: true
    });
  });
});
