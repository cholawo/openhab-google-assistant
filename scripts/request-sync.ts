import { gaxios, GoogleAuth } from 'google-auth-library';

const HOMEGRAPH_SCOPE = 'https://www.googleapis.com/auth/homegraph';
const REQUEST_SYNC_URL = 'https://homegraph.googleapis.com/v1/devices:requestSync';

type GoogleApiErrorBody = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

function readAgentUserId(argv: string[] = process.argv, env: NodeJS.ProcessEnv = process.env): string {
  return argv[2] || env.AGENT_USER_ID || 'openhab-home';
}

function printResult(details: {
  agentUserId: string;
  succeeded: boolean;
  status?: number;
  error?: unknown;
}): void {
  console.log(`agentUserId: ${details.agentUserId}`);
  console.log(`succeeded: ${details.succeeded}`);

  if (details.status !== undefined) {
    console.log(`HTTP status: ${details.status}`);
  } else {
    console.log('HTTP status: (none)');
  }

  if (details.error === undefined) {
    return;
  }

  if (details.error instanceof gaxios.GaxiosError) {
    const body = details.error.response?.data as GoogleApiErrorBody | undefined;
    const apiError = body?.error;

    if (apiError) {
      if (apiError.code !== undefined) {
        console.log(`Google error.code: ${apiError.code}`);
      }
      if (apiError.status) {
        console.log(`Google error.status: ${apiError.status}`);
      }
      if (apiError.message) {
        console.log(`Google error.message: ${apiError.message}`);
      }
      return;
    }

    if (body !== undefined) {
      console.log(`Google API error: ${JSON.stringify(body)}`);
      return;
    }
  }

  if (details.error instanceof Error) {
    console.log(`error: ${details.error.message}`);
    return;
  }

  console.log(`error: ${String(details.error)}`);
}

async function main(): Promise<void> {
  const agentUserId = readAgentUserId();
  const auth = new GoogleAuth({
    scopes: [HOMEGRAPH_SCOPE]
  });

  try {
    const client = await auth.getClient();
    const response = await client.request<Record<string, unknown>>({
      url: REQUEST_SYNC_URL,
      method: 'POST',
      data: { agentUserId }
    });

    printResult({
      agentUserId,
      succeeded: true,
      status: response.status
    });
  } catch (error) {
    const status = error instanceof gaxios.GaxiosError ? error.response?.status : undefined;
    printResult({
      agentUserId,
      succeeded: false,
      status,
      error
    });
    process.exit(1);
  }
}

void main();
