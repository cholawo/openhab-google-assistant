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

const { TextDecoder } = require('util');

const EVENTS_PATH = '/rest/events?topics=openhab/items/*/statechanged';
const DEFAULT_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 30000;

/**
 * @param {string} block
 * @returns {object | null}
 */
function parseSseBlock(block) {
  const data = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''))
    .join('\n');
  if (!data) {
    return null;
  }
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * @param {string} buffer
 * @returns {{ events: object[], rest: string }}
 */
function parseSseBuffer(buffer) {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() || '';
  const events = [];
  for (const part of parts) {
    const event = parseSseBlock(part);
    if (event) {
      events.push(event);
    }
  }
  return { events, rest };
}

/**
 * @param {object} event
 * @returns {string | null}
 */
function itemNameFromEvent(event) {
  if (event?.type !== 'ItemStateChangedEvent' || typeof event.topic !== 'string') {
    return null;
  }
  const match = event.topic.match(/^openhab\/items\/([^/]+)\/statechanged$/);
  return match ? match[1] : null;
}

/**
 * @param {{ url: string, userpass?: string }} openhab
 * @returns {Record<string, string>}
 */
function eventHeaders(openhab) {
  const headers = { Accept: 'text/event-stream' };
  if (openhab.userpass) {
    headers.Authorization = `Basic ${Buffer.from(openhab.userpass).toString('base64')}`;
  }
  return headers;
}

/**
 * @param {object} options
 * @param {{ url: string, userpass?: string }} options.openhab
 * @param {(event: object) => void} options.onEvent
 * @param {AbortSignal} [options.signal]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {boolean} [options.reconnect]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 */
async function subscribeEvents(options) {
  const fetchImpl = options.fetchImpl || fetch;
  const reconnect = options.reconnect !== false;
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let delay = DEFAULT_RECONNECT_MS;

  do {
    if (options.signal?.aborted) {
      return;
    }
    try {
      const response = await fetchImpl(`${options.openhab.url}${EVENTS_PATH}`, {
        headers: eventHeaders(options.openhab),
        signal: options.signal
      });
      if (!response.ok || !response.body) {
        throw new Error(`openHAB events HTTP ${response.status}`);
      }
      delay = DEFAULT_RECONNECT_MS;
      await readSseStream(response.body, options.onEvent, options.signal);
    } catch (error) {
      if (options.signal?.aborted) {
        return;
      }
      console.error(`openHAB events stream error: ${error.message || error}`);
    }
    if (!reconnect || options.signal?.aborted) {
      return;
    }
    await sleep(delay);
    delay = Math.min(delay * 2, MAX_RECONNECT_MS);
  } while (reconnect && !options.signal?.aborted);
}

/**
 * @param {ReadableStream} body
 * @param {(event: object) => void} onEvent
 * @param {AbortSignal} [signal]
 */
async function readSseStream(body, onEvent, signal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (!signal?.aborted) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseBuffer(buffer);
      buffer = parsed.rest;
      for (const event of parsed.events) {
        onEvent(event);
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {}
  }
}

module.exports = {
  EVENTS_PATH,
  itemNameFromEvent,
  parseSseBlock,
  parseSseBuffer,
  subscribeEvents
};
