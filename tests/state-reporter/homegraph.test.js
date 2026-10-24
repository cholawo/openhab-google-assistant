const { createHomeGraphClient, errorMessage, REPORT_STATE_URL, httpStatus } = require('../../state-reporter/homegraph');

describe('state-reporter homegraph', () => {
  test('reportState posts reportStateAndNotification with trait states', async () => {
    const request = jest.fn().mockResolvedValue({ status: 200 });
    const client = createHomeGraphClient({
      auth: {
        getClient: jest.fn().mockResolvedValue({ request })
      }
    });

    await client.reportState({
      requestId: 'req-1',
      agentUserId: 'openhab-home',
      states: {
        SwitchItem: { online: true, on: true }
      }
    });

    expect(request).toHaveBeenCalledWith({
      url: REPORT_STATE_URL,
      method: 'POST',
      data: {
        requestId: 'req-1',
        agentUserId: 'openhab-home',
        payload: {
          devices: {
            states: {
              SwitchItem: { online: true, on: true }
            }
          }
        }
      }
    });
  });

  test('httpStatus reads Gaxios-style response status', () => {
    expect(httpStatus({ response: { status: 404 } })).toBe(404);
    expect(httpStatus(new Error('network'))).toBeUndefined();
  });

  test('errorMessage prefers the Google API message', () => {
    expect(errorMessage({ response: { data: { error: { message: 'invalid state' } } } })).toBe('invalid state');
    expect(errorMessage(new Error('network'))).toBe('network');
  });
});
