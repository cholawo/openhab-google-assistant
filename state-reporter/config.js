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

/**
 * @param {string | undefined} value
 * @param {number} fallback
 * @returns {number}
 */
function readPositiveInt(value, fallback) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`REPORT_STATE_DEBOUNCE_MS must be a positive integer, got "${value}"`);
  }

  return parsed;
}

/**
 * @param {string | undefined} value
 * @returns {{ host: string, port: number, path: string, url: string, userpass?: string }}
 */
function parseOpenhabUrl(value) {
  const url = (value || 'http://127.0.0.1:8080').replace(/\/$/, '');
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`LOCAL_OPENHAB_URL must be a valid URL, got "${value}"`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`LOCAL_OPENHAB_URL must be http or https, got "${parsed.protocol}"`);
  }

  const port = parsed.port ? Number.parseInt(parsed.port, 10) : parsed.protocol === 'https:' ? 443 : 80;

  return {
    host: parsed.hostname,
    port,
    path: '/rest/items/',
    url
  };
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
function loadConfig(env = process.env) {
  const openhab = parseOpenhabUrl(env.LOCAL_OPENHAB_URL);
  if (typeof env.LOCAL_OPENHAB_USERPASS === 'string' && env.LOCAL_OPENHAB_USERPASS.length > 0) {
    openhab.userpass = env.LOCAL_OPENHAB_USERPASS;
  }
  return {
    openhab,
    agentUserId: env.AGENT_USER_ID || 'openhab-home',
    debounceMs: readPositiveInt(env.REPORT_STATE_DEBOUNCE_MS, 1000)
  };
}

module.exports = {
  loadConfig
};
