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

const OFFLINE_STATES = new Set(['NULL', 'UNDEF']);

/**
 * @param {object} item
 * @param {object[]} items
 */
function attachMembers(item, items) {
  item.members = items.filter((member) => member.groupNames && member.groupNames.includes(item.name));
  return item;
}

/**
 * @param {object[]} items
 * @returns {{ devices: Map<string, object>, parentsByMember: Map<string, string[]> }}
 */
function indexItems(items) {
  const withGa = items.filter((item) => item.metadata && item.metadata.ga);
  const devices = new Map();
  const parentsByMember = new Map();

  for (const item of withGa) {
    attachMembers(item, withGa);
    if (findDeviceType(item)) {
      devices.set(item.name, item);
    }
  }

  for (const item of items) {
    for (const groupName of item.groupNames || []) {
      if (!devices.has(groupName)) {
        continue;
      }
      const parents = parentsByMember.get(item.name) || [];
      if (!parents.includes(groupName)) {
        parents.push(groupName);
        parentsByMember.set(item.name, parents);
      }
    }
  }

  return { devices, parentsByMember };
}

/**
 * @param {string} itemName
 * @param {{ devices: Map<string, object>, parentsByMember: Map<string, string[]> }} index
 * @returns {string[]}
 */
function deviceIdsForChangedItem(itemName, index) {
  const ids = [];
  if (index.devices.has(itemName)) {
    ids.push(itemName);
  }
  for (const parent of index.parentsByMember.get(itemName) || []) {
    if (!ids.includes(parent)) {
      ids.push(parent);
    }
  }
  return ids;
}

/**
 * Build the Home Graph trait payload for an item. Returns null when the item is
 * not a Google device or has no reportable state (for example Scene).
 *
 * @param {object} item
 * @returns {object | null}
 */
function buildDeviceState(item) {
  const DeviceType = findDeviceType(item);
  if (!DeviceType) {
    return null;
  }

  const hasMembers = DeviceType.supportedMembers.length > 0;
  if (!hasMembers && OFFLINE_STATES.has(item.state)) {
    return { online: false };
  }

  const states = DeviceType.getState(item);
  if (!states || Object.keys(states).length === 0) {
    return null;
  }

  return { online: true, ...states };
}

module.exports = {
  attachMembers,
  indexItems,
  deviceIdsForChangedItem,
  buildDeviceState
};
