/**
 * Copyright (c) 2010-2025 Contributors to the openHAB project
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0
 *
 * SPDX-License-Identifier: EPL-2.0
 */

require('dotenv').config();

const ApiHandler = require('../functions/apihandler');
const OpenHAB = require('../functions/openhab');
const { loadConfig } = require('./config');
const { advertiseService } = require('./mdns/advertise');
const { listReachableDevices } = require('./reachable');
const { createApp } = require('./server');

const config = loadConfig();
const apiHandler = new ApiHandler({
  host: config.openhab.host,
  port: config.openhab.port,
  path: config.openhab.path,
  userpass: config.openhab.userpass
});
const openHAB = new OpenHAB(apiHandler);
const app = createApp({
  queryDevices: (devices) => openHAB.handleQuery(devices),
  listReachableDevices: () => listReachableDevices(apiHandler),
  executeCommands: (commands) => openHAB.handleExecute(commands)
});

const server = app.listen(config.port, '0.0.0.0', () => {
  const advertised = advertiseService(config.mdnsName, config.port);

  console.log(`HTTP listening on 0.0.0.0:${config.port}`);
  console.log(`openHAB REST URL: ${config.openhab.url}`);
  console.log(`mDNS advertising ${advertised.name} as ${advertised.type} on port ${advertised.port}`);
  console.log(`mDNS address ${advertised.interfaceName} ${advertised.address}`);

  const shutdown = async (signal) => {
    console.log(`Received ${signal}, shutting down`);
    await advertised.stop();
    server.close(() => {
      process.exit(0);
    });
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
});
