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

const os = require('os');

/**
 * @param {string} address
 * @returns {number}
 */
function ipv4ToInt(address) {
  const parts = address.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    throw new Error(`Invalid IPv4 address: ${address}`);
  }

  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * @param {string} address
 * @param {string} network
 * @param {number} prefix
 * @returns {boolean}
 */
function inCidr(address, network, prefix) {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipv4ToInt(address) & mask) === (ipv4ToInt(network) & mask);
}

/**
 * @param {string} address
 * @returns {boolean}
 */
function isDockerBridgeAddress(address) {
  return inCidr(address, '172.17.0.0', 16) || inCidr(address, '172.18.0.0', 16);
}

/**
 * @param {string} address
 * @returns {boolean}
 */
function isRfc1918(address) {
  return inCidr(address, '10.0.0.0', 8) || inCidr(address, '172.16.0.0', 12) || inCidr(address, '192.168.0.0', 16);
}

/**
 * @param {string} name
 * @returns {boolean}
 */
function isSkippedInterface(name) {
  return (
    name === 'docker0' || name === 'tailscale0' || name === 'lo' || name.startsWith('lo') || name.startsWith('br-')
  );
}

/**
 * @param {string | number} family
 * @returns {boolean}
 */
function isIpv4(family) {
  return family === 'IPv4' || family === 4;
}

/**
 * @param {NodeJS.Dict<os.NetworkInterfaceInfo[]>} [interfaces]
 * @returns {{ interfaceName: string, address: string }}
 */
function selectLanAddress(interfaces = os.networkInterfaces()) {
  const candidates = [];

  for (const [interfaceName, addrs] of Object.entries(interfaces)) {
    if (!addrs || isSkippedInterface(interfaceName)) {
      continue;
    }

    for (const addr of addrs) {
      if (!isIpv4(addr.family) || addr.internal || isDockerBridgeAddress(addr.address)) {
        continue;
      }

      candidates.push({ interfaceName, address: addr.address });
    }
  }

  const eth0 = candidates.find((candidate) => candidate.interfaceName === 'eth0');
  if (eth0) {
    return eth0;
  }

  const rfc1918 = candidates.find((candidate) => isRfc1918(candidate.address));
  if (rfc1918) {
    return rfc1918;
  }

  throw new Error('No LAN IPv4 address found (preferred eth0, then RFC1918; Docker and Tailscale excluded)');
}

module.exports = {
  selectLanAddress
};
