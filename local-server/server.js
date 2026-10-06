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

const express = require('express');

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isQueryDevice(value) {
  return typeof value === 'object' && value !== null && typeof value.id === 'string';
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isExecuteDevice(value) {
  return typeof value === 'object' && value !== null && typeof value.id === 'string';
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isExecuteCommand(value) {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return Array.isArray(value.devices) && value.devices.every(isExecuteDevice) && Array.isArray(value.execution);
}

/**
 * @param {{
 *   queryDevices: (devices: Array<{ id: string }>) => Promise<object>,
 *   listReachableDevices: () => Promise<{ devices: Array<{ verificationId: string }> }>,
 *   executeCommands: (commands: object[]) => Promise<object>
 * }} deps
 */
function createApp(deps) {
  const app = express();

  app.use(express.json());
  app.use((req, res, next) => {
    res.on('finish', () => {
      console.log(`${req.method} ${req.path} ${res.statusCode}`);
    });
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'openhab-google-local'
    });
  });

  app.get('/reachable-devices', async (_req, res) => {
    try {
      const payload = await deps.listReachableDevices();
      console.log(`REACHABLE_DEVICES ${JSON.stringify(payload.devices.map((device) => device.verificationId))}`);
      res.json(payload);
    } catch (error) {
      console.error(`REACHABLE_DEVICES failed: ${String(error)}`);
      res.status(500).json({ error: 'reachable-devices failed' });
    }
  });

  app.post('/query', async (req, res) => {
    const devices = req.body?.devices;
    if (!Array.isArray(devices) || !devices.every(isQueryDevice)) {
      res.status(400).json({ error: 'devices must be an array of { id }' });
      return;
    }

    const ids = devices.map((device) => device.id);
    console.log(`QUERY ${JSON.stringify(ids)}`);

    try {
      const payload = await deps.queryDevices(devices);
      console.log(`QUERY response ${JSON.stringify(payload)}`);
      res.json(payload);
    } catch (error) {
      console.error(`QUERY failed: ${String(error)}`);
      res.status(500).json({ error: 'query failed' });
    }
  });

  app.post('/execute', async (req, res) => {
    const commands = req.body?.commands;
    if (!Array.isArray(commands) || !commands.every(isExecuteCommand)) {
      res.status(400).json({ error: 'commands must be an array of { devices, execution }' });
      return;
    }

    console.log(`EXECUTE ${JSON.stringify(commands)}`);

    try {
      const payload = await deps.executeCommands(commands);
      console.log(`EXECUTE response ${JSON.stringify(payload)}`);
      res.json(payload);
    } catch (error) {
      console.error(`EXECUTE failed: ${String(error)}`);
      res.status(500).json({ error: 'execute failed' });
    }
  });

  return app;
}

module.exports = {
  createApp
};
