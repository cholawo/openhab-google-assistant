const { StateReporter } = require('../../state-reporter/reporter');

function createReporter() {
  const apiHandler = {
    getItems: jest.fn(),
    getItem: jest.fn()
  };
  const homegraph = {
    reportState: jest.fn().mockResolvedValue({ status: 200 })
  };
  const reporter = new StateReporter({
    apiHandler,
    homegraph,
    agentUserId: 'openhab-home',
    debounceMs: 1000,
    randomUUID: () => 'req-1'
  });
  return { reporter, apiHandler, homegraph };
}

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
const nullItem = {
  type: 'Switch',
  name: 'NullItem',
  state: 'NULL',
  metadata: { ga: { value: 'Switch' } }
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
  state: '0,0,50',
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
const heatingGroup = {
  type: 'Group',
  name: 'FF_Heating',
  state: 'NULL',
  metadata: {
    ga: {
      value: 'Thermostat',
      config: {
        modes: 'off=OFF:WINDOW_OPEN,heat=COMFORT:BOOST,eco=ECO,on=ON,auto',
        thermostatTemperatureRange: '5,25',
        useFahrenheit: false
      }
    }
  }
};
const heatingAmbient = {
  type: 'Number',
  name: 'FF_Heating_Ambient',
  state: '20.84',
  groupNames: ['FF_Heating'],
  metadata: { ga: { value: 'thermostatTemperatureAmbient' } }
};
const heatingMode = {
  type: 'String',
  name: 'FF_Heating_Mode',
  state: 'ON',
  groupNames: ['FF_Heating'],
  metadata: { ga: { value: 'thermostatMode' } }
};

function heatingItem(ambientState) {
  return {
    ...heatingGroup,
    members: [{ ...heatingAmbient, state: ambientState }, heatingMode]
  };
}

describe('state-reporter reporter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('reportSnapshot sends getState for matched devices and skips Scene', async () => {
    const { reporter, apiHandler, homegraph } = createReporter();
    apiHandler.getItems.mockResolvedValue([
      switchItem,
      sceneItem,
      nullItem,
      { type: 'Switch', name: 'Plain', state: 'ON' }
    ]);

    await expect(reporter.reportSnapshot()).resolves.toStrictEqual({
      SwitchItem: { online: true, on: true },
      NullItem: { online: false }
    });
    expect(homegraph.reportState).toHaveBeenCalledWith({
      requestId: 'req-1',
      agentUserId: 'openhab-home',
      states: {
        SwitchItem: { online: true, on: true },
        NullItem: { online: false }
      }
    });
    expect(homegraph.reportState.mock.calls[0][0].states.SceneItem).toBeUndefined();
  });

  test('debounces per device id into one report', async () => {
    const { reporter, apiHandler, homegraph } = createReporter();
    apiHandler.getItems.mockResolvedValue([switchItem]);
    apiHandler.getItem.mockResolvedValue({ ...switchItem, state: 'OFF' });
    await reporter.refreshIndex();

    await reporter.scheduleReport('SwitchItem');
    await reporter.scheduleReport('SwitchItem');
    expect(homegraph.reportState).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1000);
    expect(apiHandler.getItem).toHaveBeenCalledTimes(1);
    expect(homegraph.reportState).toHaveBeenCalledWith({
      requestId: 'req-1',
      agentUserId: 'openhab-home',
      states: {
        SwitchItem: { online: true, on: false }
      }
    });
  });

  test('a member change reports the parent group', async () => {
    const { reporter, apiHandler, homegraph } = createReporter();
    apiHandler.getItems.mockResolvedValue([lightGroup, lightColor, lightPower]);
    apiHandler.getItem.mockResolvedValue({
      ...lightGroup,
      members: [lightColor, lightPower]
    });
    await reporter.refreshIndex();

    await reporter.scheduleReport('LightColor');
    await jest.advanceTimersByTimeAsync(1000);

    expect(apiHandler.getItem).toHaveBeenCalledWith('LightItem');
    expect(homegraph.reportState).toHaveBeenCalledWith(
      expect.objectContaining({
        states: {
          LightItem: expect.objectContaining({ online: true, on: true })
        }
      })
    );
  });

  test('404 stops further reports for that id', async () => {
    const { reporter, apiHandler, homegraph } = createReporter();
    apiHandler.getItems.mockResolvedValue([switchItem]);
    apiHandler.getItem.mockResolvedValue(switchItem);
    homegraph.reportState.mockRejectedValue({ response: { status: 404 } });
    await reporter.refreshIndex();

    await reporter.scheduleReport('SwitchItem');
    await jest.advanceTimersByTimeAsync(1000);
    expect(homegraph.reportState).toHaveBeenCalledTimes(1);

    homegraph.reportState.mockClear();
    await reporter.scheduleReport('SwitchItem');
    await jest.advanceTimersByTimeAsync(1000);
    expect(homegraph.reportState).not.toHaveBeenCalled();
  });

  test('batch 400 retries each device individually', async () => {
    const { reporter, apiHandler, homegraph } = createReporter();
    apiHandler.getItems.mockResolvedValue([switchItem, nullItem]);
    homegraph.reportState
      .mockRejectedValueOnce({
        response: { status: 400, data: { error: { message: 'invalid state' } } }
      })
      .mockResolvedValue({ status: 200 });

    await reporter.reportSnapshot();
    expect(homegraph.reportState).toHaveBeenCalledTimes(3);
    expect(homegraph.reportState.mock.calls[1][0].states).toStrictEqual({
      SwitchItem: { online: true, on: true }
    });
    expect(homegraph.reportState.mock.calls[2][0].states).toStrictEqual({
      NullItem: { online: false }
    });
  });

  test('400 does not skip later reports', async () => {
    const { reporter, apiHandler, homegraph } = createReporter();
    apiHandler.getItems.mockResolvedValue([switchItem]);
    apiHandler.getItem.mockResolvedValue(switchItem);
    homegraph.reportState.mockRejectedValueOnce({ response: { status: 400 } }).mockResolvedValue({ status: 200 });
    await reporter.refreshIndex();

    await reporter.scheduleReport('SwitchItem');
    await jest.advanceTimersByTimeAsync(1000);
    await reporter.scheduleReport('SwitchItem');
    await jest.advanceTimersByTimeAsync(1000);

    expect(homegraph.reportState).toHaveBeenCalledTimes(2);
  });

  test('scheduleReport refreshes the index for an unknown member', async () => {
    const { reporter, apiHandler, homegraph } = createReporter();
    apiHandler.getItems.mockResolvedValue([lightGroup, lightColor, lightPower]);
    apiHandler.getItem.mockResolvedValue({
      ...lightGroup,
      members: [lightColor, lightPower]
    });

    await reporter.scheduleReport('LightColor');
    await jest.advanceTimersByTimeAsync(1000);

    expect(apiHandler.getItems).toHaveBeenCalledTimes(1);
    expect(homegraph.reportState).toHaveBeenCalledWith(
      expect.objectContaining({
        states: {
          LightItem: expect.objectContaining({ online: true })
        }
      })
    );
  });

  test('scheduleReport falls back to the changed item when it is not indexed', async () => {
    const { reporter, apiHandler, homegraph } = createReporter();
    apiHandler.getItems.mockResolvedValue([]);
    apiHandler.getItem.mockResolvedValue(switchItem);

    await reporter.scheduleReport('SwitchItem');
    await jest.advanceTimersByTimeAsync(1000);

    expect(apiHandler.getItem).toHaveBeenCalledWith('SwitchItem');
    expect(homegraph.reportState).toHaveBeenCalledWith({
      requestId: 'req-1',
      agentUserId: 'openhab-home',
      states: {
        SwitchItem: { online: true, on: true }
      }
    });
  });

  test('sendStates ignores skipped ids and rethrows unexpected errors', async () => {
    const { reporter, homegraph } = createReporter();
    reporter._skippedIds.add('SwitchItem');
    await reporter.sendStates({ SwitchItem: { online: true, on: true } });
    expect(homegraph.reportState).not.toHaveBeenCalled();

    homegraph.reportState.mockRejectedValueOnce(new Error('network'));
    await expect(reporter.sendStates({ OtherItem: { online: true, on: true } })).rejects.toThrow('network');
  });

  test('flush swallows getItem and send failures', async () => {
    const { reporter, apiHandler, homegraph } = createReporter();
    apiHandler.getItems.mockResolvedValue([switchItem, sceneItem]);
    await reporter.refreshIndex();

    apiHandler.getItem.mockRejectedValueOnce(new Error('down'));
    await reporter.scheduleReport('SwitchItem');
    await jest.advanceTimersByTimeAsync(1000);
    expect(homegraph.reportState).not.toHaveBeenCalled();

    apiHandler.getItem.mockResolvedValueOnce(sceneItem);
    await reporter.scheduleReport('SceneItem');
    await jest.advanceTimersByTimeAsync(1000);
    expect(homegraph.reportState).not.toHaveBeenCalled();

    apiHandler.getItem.mockResolvedValueOnce(switchItem);
    homegraph.reportState.mockRejectedValueOnce(new Error('network'));
    await reporter.scheduleReport('SwitchItem');
    await jest.advanceTimersByTimeAsync(1000);
    expect(homegraph.reportState).toHaveBeenCalledTimes(1);
  });

  test('stop clears pending debounce timers', async () => {
    const { reporter, apiHandler, homegraph } = createReporter();
    apiHandler.getItems.mockResolvedValue([switchItem]);
    apiHandler.getItem.mockResolvedValue(switchItem);
    await reporter.refreshIndex();

    await reporter.scheduleReport('SwitchItem');
    reporter.stop();
    await jest.advanceTimersByTimeAsync(1000);
    expect(homegraph.reportState).not.toHaveBeenCalled();
  });

  test('reportSnapshot seeds the cache so a later identical flush is skipped', async () => {
    const { reporter, apiHandler, homegraph } = createReporter();
    apiHandler.getItems.mockResolvedValue([switchItem]);
    apiHandler.getItem.mockResolvedValue(switchItem);

    await reporter.reportSnapshot();
    expect(homegraph.reportState).toHaveBeenCalledTimes(1);

    await reporter.scheduleReport('SwitchItem');
    await jest.advanceTimersByTimeAsync(1000);
    expect(homegraph.reportState).toHaveBeenCalledTimes(1);
  });

  test('skips an identical state after a successful report', async () => {
    const { reporter, apiHandler, homegraph } = createReporter();
    apiHandler.getItems.mockResolvedValue([switchItem]);
    apiHandler.getItem.mockResolvedValue(switchItem);
    await reporter.refreshIndex();

    await reporter.scheduleReport('SwitchItem');
    await jest.advanceTimersByTimeAsync(1000);
    await reporter.scheduleReport('SwitchItem');
    await jest.advanceTimersByTimeAsync(1000);

    expect(homegraph.reportState).toHaveBeenCalledTimes(1);
  });

  test('reports again when the resolved state changes', async () => {
    const { reporter, apiHandler, homegraph } = createReporter();
    apiHandler.getItems.mockResolvedValue([switchItem]);
    apiHandler.getItem.mockResolvedValueOnce(switchItem).mockResolvedValueOnce({ ...switchItem, state: 'OFF' });
    await reporter.refreshIndex();

    await reporter.scheduleReport('SwitchItem');
    await jest.advanceTimersByTimeAsync(1000);
    await reporter.scheduleReport('SwitchItem');
    await jest.advanceTimersByTimeAsync(1000);

    expect(homegraph.reportState).toHaveBeenCalledTimes(2);
    expect(homegraph.reportState.mock.calls[0][0].states).toStrictEqual({
      SwitchItem: { online: true, on: true }
    });
    expect(homegraph.reportState.mock.calls[1][0].states).toStrictEqual({
      SwitchItem: { online: true, on: false }
    });
  });

  test('skips thermostat reports whose normalized payload is unchanged', async () => {
    const { reporter, apiHandler, homegraph } = createReporter();
    apiHandler.getItems.mockResolvedValue([heatingGroup, heatingAmbient, heatingMode]);
    apiHandler.getItem.mockResolvedValueOnce(heatingItem('20.84')).mockResolvedValueOnce(heatingItem('20.76'));
    await reporter.refreshIndex();

    await reporter.scheduleReport('FF_Heating_Ambient');
    await jest.advanceTimersByTimeAsync(1000);
    await reporter.scheduleReport('FF_Heating_Ambient');
    await jest.advanceTimersByTimeAsync(1000);

    expect(homegraph.reportState).toHaveBeenCalledTimes(1);
    expect(homegraph.reportState).toHaveBeenCalledWith({
      requestId: 'req-1',
      agentUserId: 'openhab-home',
      states: {
        FF_Heating: {
          online: true,
          thermostatTemperatureAmbient: 20.8,
          thermostatMode: 'on'
        }
      }
    });
  });

  test('failed reports do not seed the cache', async () => {
    const { reporter, apiHandler, homegraph } = createReporter();
    apiHandler.getItems.mockResolvedValue([switchItem]);
    apiHandler.getItem.mockResolvedValue(switchItem);
    homegraph.reportState.mockRejectedValueOnce({ response: { status: 400 } }).mockResolvedValue({ status: 200 });
    await reporter.refreshIndex();

    await reporter.scheduleReport('SwitchItem');
    await jest.advanceTimersByTimeAsync(1000);
    await reporter.scheduleReport('SwitchItem');
    await jest.advanceTimersByTimeAsync(1000);

    expect(homegraph.reportState).toHaveBeenCalledTimes(2);
  });

  test('sendStates omits unchanged devices from a mixed batch', async () => {
    const { reporter, homegraph } = createReporter();
    await reporter.sendStates({
      SwitchItem: { online: true, on: true },
      NullItem: { online: false }
    });
    homegraph.reportState.mockClear();

    await reporter.sendStates({
      SwitchItem: { online: true, on: true },
      NullItem: { online: true }
    });
    expect(homegraph.reportState).toHaveBeenCalledTimes(1);
    expect(homegraph.reportState).toHaveBeenCalledWith({
      requestId: 'req-1',
      agentUserId: 'openhab-home',
      states: {
        NullItem: { online: true }
      }
    });
  });
});
