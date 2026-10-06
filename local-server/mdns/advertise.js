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

const { spawn } = require('child_process');
const { selectLanAddress } = require('./lan-address');

const MDNS_TYPE = 'openhab-google';
const MDNS_PROTOCOL = 'tcp';
const MDNS_SERVICE_TYPE = `_${MDNS_TYPE}._${MDNS_PROTOCOL}.local`;

/**
 * @param {string} command
 * @param {string[]} args
 * @returns {import('child_process').ChildProcess}
 */
function spawnAvahi(command, args) {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stderr.on('data', (chunk) => {
    const message = chunk.toString().trim();
    if (message) {
      console.error(`${command}: ${message}`);
    }
  });

  child.on('error', (error) => {
    console.error(`${command} failed to start: ${error.message}`);
  });

  child.on('exit', (code, signal) => {
    if (code && code !== 0) {
      console.error(`${command} exited with code ${code}${signal ? ` signal ${signal}` : ''}`);
    }
  });

  return child;
}

/**
 * @param {import('child_process').ChildProcess} child
 * @returns {Promise<void>}
 */
function stopChild(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }

    child.once('exit', () => resolve());
    child.kill('SIGTERM');
  });
}

/**
 * @param {string} name
 * @param {number} port
 */
function advertiseService(name, port) {
  const lan = selectLanAddress();
  const hostname = `${name}.local`;
  const serviceType = `_${MDNS_TYPE}._${MDNS_PROTOCOL}`;

  const addressPublisher = spawnAvahi('avahi-publish-address', ['-R', hostname, lan.address]);
  const servicePublisher = spawnAvahi('avahi-publish-service', ['-H', hostname, name, serviceType, String(port)]);

  return {
    name,
    type: MDNS_SERVICE_TYPE,
    port,
    interfaceName: lan.interfaceName,
    address: lan.address,
    stop: async () => {
      await Promise.all([stopChild(servicePublisher), stopChild(addressPublisher)]);
    }
  };
}

module.exports = {
  MDNS_SERVICE_TYPE,
  advertiseService
};
