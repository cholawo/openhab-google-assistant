const { createApp } = require('../../local-server/server');

function startApp(deps) {
  const app = createApp(deps);
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done))
      });
    });
  });
}

describe('local-server HTTP routes', () => {
  const deps = {
    queryDevices: jest.fn(),
    listReachableDevices: jest.fn(),
    executeCommands: jest.fn()
  };
  let runtime;

  beforeEach(async () => {
    jest.clearAllMocks();
    runtime = await startApp(deps);
  });

  afterEach(async () => {
    await runtime.close();
  });

  test('GET /health', async () => {
    const response = await fetch(`${runtime.baseUrl}/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({
      status: 'ok',
      service: 'openhab-google-local'
    });
  });

  test('GET /reachable-devices', async () => {
    deps.listReachableDevices.mockResolvedValue({
      devices: [{ verificationId: 'SwitchItem' }]
    });

    const response = await fetch(`${runtime.baseUrl}/reachable-devices`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({
      devices: [{ verificationId: 'SwitchItem' }]
    });
    expect(deps.listReachableDevices).toHaveBeenCalledTimes(1);
  });

  test('POST /query', async () => {
    const devices = [{ id: 'SwitchItem' }];
    deps.queryDevices.mockResolvedValue({
      devices: {
        SwitchItem: { status: 'SUCCESS', online: true, on: true }
      }
    });

    const response = await fetch(`${runtime.baseUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ devices })
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({
      devices: {
        SwitchItem: { status: 'SUCCESS', online: true, on: true }
      }
    });
    expect(deps.queryDevices).toHaveBeenCalledWith(devices);
  });

  test('POST /execute', async () => {
    const commands = [
      {
        devices: [{ id: 'SwitchItem', customData: { deviceType: 'Switch', itemType: 'Switch' } }],
        execution: [{ command: 'action.devices.commands.OnOff', params: { on: true } }]
      }
    ];
    deps.executeCommands.mockResolvedValue({
      commands: [{ ids: ['SwitchItem'], status: 'SUCCESS', states: { on: true, online: true } }]
    });

    const response = await fetch(`${runtime.baseUrl}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands })
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({
      commands: [{ ids: ['SwitchItem'], status: 'SUCCESS', states: { on: true, online: true } }]
    });
    expect(deps.executeCommands).toHaveBeenCalledWith(commands);
  });

  test('POST /query rejects a malformed body', async () => {
    const response = await fetch(`${runtime.baseUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ devices: [{ name: 'SwitchItem' }] })
    });
    expect(response.status).toBe(400);
    expect(deps.queryDevices).not.toHaveBeenCalled();
  });

  test('POST /execute rejects a malformed body', async () => {
    const response = await fetch(`${runtime.baseUrl}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands: [{ devices: [{ id: 'SwitchItem' }] }] })
    });
    expect(response.status).toBe(400);
    expect(deps.executeCommands).not.toHaveBeenCalled();
  });

  test('GET /reachable-devices returns 500 when listing fails', async () => {
    deps.listReachableDevices.mockRejectedValue(new Error('openHAB down'));
    const response = await fetch(`${runtime.baseUrl}/reachable-devices`);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toStrictEqual({ error: 'reachable-devices failed' });
  });

  test('POST /query returns 500 when query fails', async () => {
    deps.queryDevices.mockRejectedValue(new Error('query failed'));
    const response = await fetch(`${runtime.baseUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ devices: [{ id: 'SwitchItem' }] })
    });
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toStrictEqual({ error: 'query failed' });
  });

  test('POST /execute returns 500 when execute fails', async () => {
    deps.executeCommands.mockRejectedValue(new Error('execute failed'));
    const response = await fetch(`${runtime.baseUrl}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          {
            devices: [{ id: 'SwitchItem' }],
            execution: [{ command: 'action.devices.commands.OnOff', params: { on: true } }]
          }
        ]
      })
    });
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toStrictEqual({ error: 'execute failed' });
  });
});
