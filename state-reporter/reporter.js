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

const { randomUUID } = require('crypto');
const { errorMessage, httpStatus } = require('./homegraph');
const { buildDeviceState, deviceIdsForChangedItem, indexItems } = require('./state');

/**
 * @param {unknown} left
 * @param {unknown} right
 * @returns {boolean}
 */
function statesEqual(left, right) {
  if (Object.is(left, right)) {
    return true;
  }
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => statesEqual(value, right[index]))
    );
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => Object.hasOwn(right, key) && statesEqual(left[key], right[key]))
  );
}

/**
 * @param {object} state
 * @returns {object}
 */
function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

class StateReporter {
  /**
   * @param {object} options
   * @param {{ getItems: () => Promise<object[]>, getItem: (name: string) => Promise<object> }} options.apiHandler
   * @param {{ reportState: (report: object) => Promise<{ status?: number }> }} options.homegraph
   * @param {string} options.agentUserId
   * @param {number} [options.debounceMs]
   * @param {() => string} [options.randomUUID]
   */
  constructor(options) {
    this._apiHandler = options.apiHandler;
    this._homegraph = options.homegraph;
    this._agentUserId = options.agentUserId;
    this._debounceMs = options.debounceMs ?? 1000;
    this._randomUUID = options.randomUUID || randomUUID;
    this._index = { devices: new Map(), parentsByMember: new Map() };
    this._skippedIds = new Set();
    this._lastReportedStates = new Map();
    this._timers = new Map();
  }

  /**
   * @returns {Promise<object[]>}
   */
  async refreshIndex() {
    const items = await this._apiHandler.getItems();
    this._index = indexItems(items);
    return items;
  }

  /**
   * Report every matched device once so Home Graph has a snapshot.
   */
  async reportSnapshot() {
    const items = await this.refreshIndex();
    const states = {};
    for (const item of items) {
      if (!this._index.devices.has(item.name)) {
        continue;
      }
      const state = buildDeviceState(item);
      if (state) {
        states[item.name] = state;
      }
    }
    await this.sendStates(states);
    return states;
  }

  /**
   * @param {string} itemName
   */
  async scheduleReport(itemName) {
    let ids = deviceIdsForChangedItem(itemName, this._index);
    if (ids.length === 0) {
      await this.refreshIndex();
      ids = deviceIdsForChangedItem(itemName, this._index);
    }
    if (ids.length === 0) {
      ids = [itemName];
    }
    for (const id of ids) {
      this._debounce(id);
    }
  }

  stop() {
    for (const timer of this._timers.values()) {
      clearTimeout(timer);
    }
    this._timers.clear();
  }

  /**
   * @param {Record<string, object>} states
   */
  async sendStates(states) {
    const ids = Object.keys(states).filter(
      (id) => !this._skippedIds.has(id) && !this._hasUnchangedState(id, states[id])
    );
    if (ids.length === 0) {
      return;
    }
    const payload = {};
    for (const id of ids) {
      payload[id] = states[id];
    }
    try {
      const response = await this._homegraph.reportState({
        requestId: this._randomUUID(),
        agentUserId: this._agentUserId,
        states: payload
      });
      console.log(`Reported state for ${ids.join(', ')} (HTTP ${response?.status ?? 200})`);
      this._rememberReportedStates(payload);
    } catch (error) {
      const status = httpStatus(error);
      if (status === 404) {
        for (const id of ids) {
          this._skippedIds.add(id);
        }
        console.error(`Home Graph 404 for ${ids.join(', ')}; stopping reports for those ids until the next sync`);
        return;
      }
      if (status === 400) {
        console.error(`Home Graph 400 for ${ids.join(', ')}: ${errorMessage(error)}`);
        if (ids.length > 1) {
          for (const id of ids) {
            await this.sendStates({ [id]: payload[id] });
          }
        }
        return;
      }
      throw error;
    }
  }

  /**
   * @param {string} id
   * @param {object} state
   * @returns {boolean}
   */
  _hasUnchangedState(id, state) {
    const previous = this._lastReportedStates.get(id);
    return previous !== undefined && statesEqual(previous, state);
  }

  /**
   * @param {Record<string, object>} states
   */
  _rememberReportedStates(states) {
    for (const [id, state] of Object.entries(states)) {
      this._lastReportedStates.set(id, cloneState(state));
    }
  }

  /**
   * @param {string} id
   */
  _debounce(id) {
    if (this._skippedIds.has(id)) {
      return;
    }
    const existing = this._timers.get(id);
    if (existing) {
      clearTimeout(existing);
    }
    this._timers.set(
      id,
      setTimeout(() => {
        this._timers.delete(id);
        void this._flush(id);
      }, this._debounceMs)
    );
  }

  /**
   * @param {string} id
   */
  async _flush(id) {
    if (this._skippedIds.has(id)) {
      return;
    }
    let item;
    try {
      item = await this._apiHandler.getItem(id);
    } catch (error) {
      console.error(`Failed to load item ${id}: ${error.message || error}`);
      return;
    }
    const state = buildDeviceState(item);
    if (!state) {
      return;
    }
    try {
      await this.sendStates({ [id]: state });
    } catch (error) {
      console.error(`Failed to report ${id}: ${error.message || error}`);
    }
  }
}

module.exports = {
  StateReporter
};
