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

const EXCLUDED_TYPES = new Set([
  'action.devices.types.CAMERA',
  'action.devices.types.LOCK',
  'action.devices.types.SECURITYSYSTEM',
  'action.devices.types.DOOR',
  'action.devices.types.GARAGE',
  'action.devices.types.GATE'
]);

/**
 * @param {object} item
 * @param {object} DeviceType
 * @returns {boolean}
 */
function supportsLocalFulfillment(item, DeviceType) {
  if (!DeviceType?.type || EXCLUDED_TYPES.has(DeviceType.type)) {
    return false;
  }

  const config = DeviceType.getConfig?.(item) || item?.metadata?.ga?.config || {};
  if (config.ackNeeded === true || config.tfaAck === true) {
    return false;
  }
  if (typeof config.pinNeeded === 'string' || typeof config.tfaPin === 'string') {
    return false;
  }

  return true;
}

module.exports = {
  supportsLocalFulfillment
};
