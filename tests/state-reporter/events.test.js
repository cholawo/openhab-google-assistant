const { itemNameFromEvent, parseSseBuffer, subscribeEvents } = require('../../state-reporter/events');

describe('state-reporter events', () => {
  test('itemNameFromEvent reads ItemStateChangedEvent topics only', () => {
    expect(
      itemNameFromEvent({
        type: 'ItemStateChangedEvent',
        topic: 'openhab/items/KitchenLight/statechanged'
      })
    ).toBe('KitchenLight');
    expect(
      itemNameFromEvent({
        type: 'ItemStateEvent',
        topic: 'openhab/items/KitchenLight/state'
      })
    ).toBeNull();
    expect(itemNameFromEvent({ type: 'ItemStateChangedEvent', topic: 'other' })).toBeNull();
  });

  test('parseSseBuffer extracts JSON data blocks', () => {
    const { events, rest } = parseSseBuffer(
      'event: message\ndata: {"type":"ItemStateChangedEvent","topic":"openhab/items/A/statechanged"}\n\npartial'
    );
    expect(events).toStrictEqual([{ type: 'ItemStateChangedEvent', topic: 'openhab/items/A/statechanged' }]);
    expect(rest).toBe('partial');
  });

  test('parseSseBuffer skips empty or invalid data blocks', () => {
    const { events } = parseSseBuffer('event: ping\n\ndata: not-json\n\n');
    expect(events).toEqual([]);
  });

  test('subscribeEvents returns immediately when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = jest.fn();
    await subscribeEvents({
      openhab: { url: 'http://127.0.0.1:8080' },
      onEvent: jest.fn(),
      signal: controller.signal,
      fetchImpl
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('subscribeEvents reconnects after a failed fetch then stops', async () => {
    const fetchImpl = jest.fn().mockRejectedValueOnce(new Error('connection reset')).mockResolvedValueOnce({
      ok: false,
      status: 503,
      body: null
    });
    const sleep = jest.fn().mockResolvedValue(undefined);
    const controller = new AbortController();
    sleep.mockImplementation(async () => {
      controller.abort();
    });

    await subscribeEvents({
      openhab: { url: 'http://127.0.0.1:8080' },
      onEvent: jest.fn(),
      signal: controller.signal,
      fetchImpl,
      sleep
    });
    expect(fetchImpl).toHaveBeenCalled();
    expect(sleep).toHaveBeenCalled();
  });

  test('subscribeEvents delivers parsed events and stops without reconnect', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"type":"ItemStateChangedEvent","topic":"openhab/items/SwitchItem/statechanged"}\n\n')
        );
        controller.close();
      }
    });
    const onEvent = jest.fn();
    await subscribeEvents({
      openhab: { url: 'http://127.0.0.1:8080' },
      onEvent,
      reconnect: false,
      fetchImpl: jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: stream
      })
    });
    expect(onEvent).toHaveBeenCalledWith({
      type: 'ItemStateChangedEvent',
      topic: 'openhab/items/SwitchItem/statechanged'
    });
  });

  test('subscribeEvents sends Basic auth when userpass is set', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          controller.close();
        }
      })
    });
    await subscribeEvents({
      openhab: { url: 'http://127.0.0.1:8080', userpass: 'user:secret' },
      onEvent: jest.fn(),
      reconnect: false,
      fetchImpl
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/rest/events?topics=openhab/items/*/statechanged',
      expect.objectContaining({
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Basic ${Buffer.from('user:secret').toString('base64')}`
        }
      })
    );
  });
});
