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

const { findDeviceType } = require('../functions/deviceMatcher');
const { supportsLocalFulfillment } = require('../functions/localFulfillment');

/**
 * @param {{ getItems: () => Promise<object[]> }} apiHandler
 * @returns {Promise<{ devices: Array<{ verificationId: string }> }>}
 */
async function listReachableDevices(apiHandler) {
  const items = await apiHandler.getItems();
  const withGa = items.filter((item) => item.metadata && item.metadata.ga);
  const devices = [];

  for (const item of withGa) {
    item.members = withGa.filter((member) => member.groupNames && member.groupNames.includes(item.name));
    const DeviceType = findDeviceType(item);
    if (DeviceType && supportsLocalFulfillment(item, DeviceType) && item.name) {
      devices.push({ verificationId: item.name });
    }
  }

  return { devices };
}

module.exports = {
  listReachableDevices
};
