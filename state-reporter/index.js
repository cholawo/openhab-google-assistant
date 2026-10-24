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
const { loadConfig } = require('./config');
const { createHomeGraphClient } = require('./homegraph');
const { itemNameFromEvent, subscribeEvents } = require('./events');
const { StateReporter } = require('./reporter');

async function main() {
  const config = loadConfig();
  const apiHandler = new ApiHandler({
    host: config.openhab.host,
    port: config.openhab.port,
    path: config.openhab.path,
    userpass: config.openhab.userpass
  });
  const reporter = new StateReporter({
    apiHandler,
    homegraph: createHomeGraphClient(),
    agentUserId: config.agentUserId,
    debounceMs: config.debounceMs
  });

  console.log(`Reporting Home Graph state for agentUserId ${config.agentUserId}`);
  console.log(`openHAB REST URL: ${config.openhab.url}`);

  try {
    const states = await reporter.reportSnapshot();
    console.log(`Startup snapshot reported ${Object.keys(states).length} device(s)`);
  } catch (error) {
    console.error(`Startup snapshot failed: ${error.message || error}`);
  }

  const controller = new AbortController();
  const subscription = subscribeEvents({
    openhab: config.openhab,
    signal: controller.signal,
    onEvent: (event) => {
      const itemName = itemNameFromEvent(event);
      if (itemName) {
        void reporter.scheduleReport(itemName);
      }
    }
  });

  const shutdown = (signal) => {
    console.log(`Received ${signal}, shutting down`);
    controller.abort();
    reporter.stop();
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  await subscription;
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  main
};
