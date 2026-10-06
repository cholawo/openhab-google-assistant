/// <reference types="@google/local-home-sdk" />

const PROXY_DEVICE_ID = 'openhab-local';

function readHttpJson<T>(httpResult: smarthome.DataFlow.HttpResponseData): T {
  const statusCode = httpResult.httpResponse.statusCode;
  if (statusCode < 200 || statusCode > 299) {
    throw new Error(`HTTP ${statusCode}`);
  }
  const body = httpResult.httpResponse.body;
  return (typeof body === 'string' ? JSON.parse(body) : body) as T;
}

function identifyHandler(request: smarthome.IntentFlow.IdentifyRequest): smarthome.IntentFlow.IdentifyResponse {
  const device = request.inputs[0].payload.device;
  const scanData = device.mdnsScanData;

  console.log(`IDENTIFY requestId=${request.requestId}`);
  console.log(`IDENTIFY mdnsScanData: ${JSON.stringify(scanData)}`);

  if (!scanData) {
    throw new smarthome.IntentFlow.HandlerError(request.requestId, 'invalid_request', 'Missing mdnsScanData');
  }

  console.log(
    `IDENTIFY mDNS serviceName=${scanData.serviceName} name=${scanData.name} type=${scanData.type} protocol=${scanData.protocol}`
  );

  const response: smarthome.IntentFlow.IdentifyResponse = {
    intent: smarthome.Intents.IDENTIFY,
    requestId: request.requestId,
    payload: {
      device: {
        id: PROXY_DEVICE_ID,
        isProxy: true,
        isLocalOnly: true
      }
    }
  };

  console.log(`IDENTIFY response: ${JSON.stringify(response)}`);
  return response;
}

const QUERY_PORT = Number.parseInt(process.env.LOCAL_PORT ?? '3002', 10);

const app = new smarthome.App('1.0.0');

function logRegisteredDevices(): void {
  const getRegisteredDevices = app.getDeviceManager().getRegisteredDevices;
  if (typeof getRegisteredDevices !== 'function') {
    console.log('REACHABLE_DEVICES registered devices: unavailable');
    return;
  }
  console.log(`REACHABLE_DEVICES registered devices: ${JSON.stringify(getRegisteredDevices())}`);
}

function proxySelectedHandler(
  request: smarthome.IntentFlow.ProxySelectedRequest
): smarthome.IntentFlow.ProxySelectedResponse {
  const payload = request.inputs[0]?.payload;
  const device = payload?.device;

  console.log(`PROXY_SELECTED requestId=${request.requestId}`);
  console.log(`PROXY_SELECTED request: ${JSON.stringify(payload)}`);
  console.log(
    `PROXY_SELECTED deviceId=${String(device?.id)} customData=${JSON.stringify(device?.customData)} proxyData=${JSON.stringify(device?.proxyData)}`
  );

  const response: smarthome.IntentFlow.ProxySelectedResponse = {
    intent: smarthome.Intents.PROXY_SELECTED,
    requestId: request.requestId,
    payload: {}
  };
  console.log(`PROXY_SELECTED response: ${JSON.stringify(response)}`);
  return response;
}

async function reachableDevicesHandler(
  request: smarthome.IntentFlow.ReachableDevicesRequest
): Promise<smarthome.IntentFlow.ReachableDevicesResponse> {
  const emptyResponse: smarthome.IntentFlow.ReachableDevicesResponse = {
    intent: smarthome.Intents.REACHABLE_DEVICES,
    requestId: request.requestId,
    payload: {
      devices: []
    }
  };

  console.log(`REACHABLE_DEVICES requestId=${request.requestId}`);
  console.log(`REACHABLE_DEVICES request: ${JSON.stringify(request.inputs[0]?.payload)}`);

  try {
    const command = new smarthome.DataFlow.HttpRequestData();
    command.requestId = request.requestId;
    command.deviceId = PROXY_DEVICE_ID;
    command.protocol = smarthome.Constants.Protocol.HTTP;
    command.method = smarthome.Constants.HttpOperation.GET;
    command.port = QUERY_PORT;
    command.path = '/reachable-devices';

    const result = await app.getDeviceManager().send(command);
    const payload = readHttpJson<{ devices?: unknown }>(result as smarthome.DataFlow.HttpResponseData);
    const devices = Array.isArray(payload?.devices) ? payload.devices : [];
    const response: smarthome.IntentFlow.ReachableDevicesResponse = {
      intent: smarthome.Intents.REACHABLE_DEVICES,
      requestId: request.requestId,
      payload: {
        devices
      }
    };
    console.log(`REACHABLE_DEVICES response: ${JSON.stringify(response)}`);
    return response;
  } catch (error) {
    console.error(`REACHABLE_DEVICES send failed: ${String(error)}`);
    console.log(`REACHABLE_DEVICES response: ${JSON.stringify(emptyResponse)}`);
    return emptyResponse;
  } finally {
    logRegisteredDevices();
  }
}

async function queryHandler(request: smarthome.IntentFlow.QueryRequest): Promise<smarthome.IntentFlow.QueryResponse> {
  const devices = request.inputs[0]?.payload?.devices ?? [];

  console.log(`QUERY requestId=${request.requestId}`);
  console.log(`QUERY devices: ${JSON.stringify(devices)}`);

  if (devices.length === 0) {
    const response: smarthome.IntentFlow.QueryResponse = {
      requestId: request.requestId,
      payload: { devices: {} }
    };
    console.log(`QUERY response: ${JSON.stringify(response)}`);
    return response;
  }

  const command = new smarthome.DataFlow.HttpRequestData();
  command.requestId = request.requestId;
  command.deviceId = devices[0].id;
  command.protocol = smarthome.Constants.Protocol.HTTP;
  command.method = smarthome.Constants.HttpOperation.POST;
  command.port = QUERY_PORT;
  command.path = '/query';
  command.dataType = 'application/json';
  command.data = JSON.stringify({ devices });

  try {
    const result = await app.getDeviceManager().send(command);
    const payload = readHttpJson<smarthome.IntentFlow.QueryPayload>(result as smarthome.DataFlow.HttpResponseData);
    const response: smarthome.IntentFlow.QueryResponse = {
      requestId: request.requestId,
      payload
    };
    console.log(`QUERY response: ${JSON.stringify(response)}`);
    return response;
  } catch (error) {
    console.error(`QUERY send failed: ${String(error)}`);
    throw new smarthome.IntentFlow.HandlerError(request.requestId, 'deviceOffline', String(error));
  }
}

async function executeHandler(request: smarthome.IntentFlow.ExecuteRequest): Promise<smarthome.IntentFlow.ExecuteResponse> {
  const commands = request.inputs[0]?.payload?.commands ?? [];

  console.log(`EXECUTE requestId=${request.requestId}`);
  console.log(`EXECUTE commands: ${JSON.stringify(commands)}`);

  if (commands.length === 0) {
    const response: smarthome.IntentFlow.ExecuteResponse = {
      requestId: request.requestId,
      payload: { commands: [] }
    };
    console.log(`EXECUTE response: ${JSON.stringify(response)}`);
    return response;
  }

  const command = new smarthome.DataFlow.HttpRequestData();
  command.requestId = request.requestId;
  command.deviceId = commands[0].devices[0]?.id ?? PROXY_DEVICE_ID;
  command.protocol = smarthome.Constants.Protocol.HTTP;
  command.method = smarthome.Constants.HttpOperation.POST;
  command.port = QUERY_PORT;
  command.path = '/execute';
  command.dataType = 'application/json';
  command.data = JSON.stringify({ commands });

  try {
    const result = await app.getDeviceManager().send(command);
    const payload = readHttpJson<smarthome.IntentFlow.ExecutePayload>(result as smarthome.DataFlow.HttpResponseData);
    const response: smarthome.IntentFlow.ExecuteResponse = {
      requestId: request.requestId,
      payload
    };
    console.log(`EXECUTE response: ${JSON.stringify(response)}`);
    return response;
  } catch (error) {
    console.error(`EXECUTE send failed: ${String(error)}`);
    throw new smarthome.IntentFlow.HandlerError(request.requestId, 'deviceOffline', String(error));
  }
}

app
  .onIdentify(identifyHandler)
  .onReachableDevices(reachableDevicesHandler)
  .onProxySelected(proxySelectedHandler)
  .onQuery(queryHandler)
  .onExecute(executeHandler)
  .listen()
  .then(() => {
    console.log('Local Home app ready');
  });
