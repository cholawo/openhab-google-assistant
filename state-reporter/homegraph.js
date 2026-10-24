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

const { GoogleAuth, gaxios } = require('google-auth-library');

const HOMEGRAPH_SCOPE = 'https://www.googleapis.com/auth/homegraph';
const REPORT_STATE_URL = 'https://homegraph.googleapis.com/v1/devices:reportStateAndNotification';

/**
 * @param {unknown} error
 * @returns {number | undefined}
 */
function httpStatus(error) {
  if (error instanceof gaxios.GaxiosError) {
    return error.response?.status;
  }
  if (error && typeof error === 'object' && 'response' in error) {
    return error.response?.status;
  }
  return undefined;
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function errorMessage(error) {
  if (error && typeof error === 'object' && 'response' in error) {
    const apiError = error.response?.data?.error;
    if (apiError?.message) {
      return apiError.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * @param {{ auth?: GoogleAuth }} [options]
 */
function createHomeGraphClient(options = {}) {
  const auth = options.auth || new GoogleAuth({ scopes: [HOMEGRAPH_SCOPE] });

  /**
   * @param {{ agentUserId: string, requestId: string, states: Record<string, object> }} report
   */
  async function reportState(report) {
    const client = await auth.getClient();
    return client.request({
      url: REPORT_STATE_URL,
      method: 'POST',
      data: {
        requestId: report.requestId,
        agentUserId: report.agentUserId,
        payload: {
          devices: {
            states: report.states
          }
        }
      }
    });
  }

  return { reportState };
}

module.exports = {
  HOMEGRAPH_SCOPE,
  REPORT_STATE_URL,
  createHomeGraphClient,
  errorMessage,
  httpStatus
};
