import { ExecutionResult, SubmissionStatusType } from '@codecollab/shared';
import { getLanguageConfig } from '../config/languages';
import { EXECUTION_CONFIG } from '../config/execution';

/**
 * Safely decodes base64 strings returned by Judge0 CE API.
 */
function decodeBase64(val: string | null | undefined): string | null {
  if (!val || typeof val !== 'string') {
    return null;
  }
  try {
    return Buffer.from(val, 'base64').toString('utf8');
  } catch {
    return val;
  }
}

/**
 * Truncates output strings if they exceed configured MAX_OUTPUT_BYTES limit.
 */
function truncateOutput(text: string | null): string | null {
  if (!text) return null;
  if (Buffer.byteLength(text, 'utf8') > EXECUTION_CONFIG.MAX_OUTPUT_BYTES) {
    const truncated = Buffer.from(text, 'utf8')
      .subarray(0, EXECUTION_CONFIG.MAX_OUTPUT_BYTES)
      .toString('utf8');
    return `${truncated}\n[Output truncated: exceeded ${EXECUTION_CONFIG.MAX_OUTPUT_BYTES} bytes limit]`;
  }
  return text;
}

export async function executeCodeInSandbox(
  sourceCode: string,
  language: string,
  stdin: string = ''
): Promise<ExecutionResult> {
  const langConfig = getLanguageConfig(language);
  if (!langConfig) {
    return {
      status: 'SYSTEM_ERROR',
      stderr: `Unsupported language: ${language}`,
      exitCode: 1,
    };
  }

  // Check code size limit
  if (Buffer.byteLength(sourceCode, 'utf8') > EXECUTION_CONFIG.MAX_CODE_SIZE_BYTES) {
    return {
      status: 'SYSTEM_ERROR',
      stderr: `Source code exceeds maximum allowed size of ${EXECUTION_CONFIG.MAX_CODE_SIZE_BYTES} bytes.`,
      exitCode: 1,
    };
  }

  // Check stdin size limit
  if (Buffer.byteLength(stdin || '', 'utf8') > EXECUTION_CONFIG.MAX_STDIN_SIZE_BYTES) {
    return {
      status: 'SYSTEM_ERROR',
      stderr: `Standard input exceeds maximum allowed size of ${EXECUTION_CONFIG.MAX_STDIN_SIZE_BYTES} bytes.`,
      exitCode: 1,
    };
  }

  const runnerUrl = EXECUTION_CONFIG.RUNNER_URL;
  const apiKey = EXECUTION_CONFIG.RUNNER_API_KEY;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EXECUTION_CONFIG.RUNNER_TIMEOUT_MS);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['X-RapidAPI-Key'] = apiKey;
      headers['X-RapidAPI-Host'] = 'judge0-ce.p.rapidapi.com';
    }

    const sourceCodeBase64 = Buffer.from(sourceCode, 'utf8').toString('base64');
    const stdinBase64 = Buffer.from(stdin || '', 'utf8').toString('base64');

    const response = await fetch(
      `${runnerUrl}/submissions?base64_encoded=true&wait=true`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          source_code: sourceCodeBase64,
          language_id: langConfig.judge0Id,
          stdin: stdinBase64,
          cpu_time_limit: EXECUTION_CONFIG.MAX_EXECUTION_TIME_MS / 1000,
          memory_limit: EXECUTION_CONFIG.MAX_MEMORY_MB * 1024,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const status = response.status;
      if (status === 400) {
        return {
          status: 'SYSTEM_ERROR',
          stderr: 'Execution service rejected request (HTTP 400).',
          exitCode: 1,
        };
      }
      if (status === 401 || status === 403) {
        return {
          status: 'SYSTEM_ERROR',
          stderr: `Execution service authentication failed (HTTP ${status}).`,
          exitCode: 1,
        };
      }
      if (status === 404) {
        return {
          status: 'SYSTEM_ERROR',
          stderr: 'Execution service endpoint not found (HTTP 404).',
          exitCode: 1,
        };
      }
      if (status === 429) {
        return {
          status: 'SYSTEM_ERROR',
          stderr: 'Execution service rate limit exceeded (HTTP 429).',
          exitCode: 1,
        };
      }
      if (status >= 500) {
        return {
          status: 'SYSTEM_ERROR',
          stderr: `Execution service error (HTTP ${status}).`,
          exitCode: 1,
        };
      }
      return {
        status: 'SYSTEM_ERROR',
        stderr: `Execution service returned unexpected status (HTTP ${status}).`,
        exitCode: 1,
      };
    }

    let data: {
      status?: { id: number; description?: string };
      stdout?: string | null;
      stderr?: string | null;
      compile_output?: string | null;
      time?: string | number | null;
      memory?: number | null;
      exit_code?: number | null;
      message?: string | null;
    };

    try {
      data = await response.json();
    } catch {
      return {
        status: 'SYSTEM_ERROR',
        stderr: 'Malformed response received from execution service.',
        exitCode: 1,
      };
    }

    return normalizeJudge0Response(data);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        status: 'SYSTEM_ERROR',
        stderr: 'Execution service timed out waiting for runner.',
        exitCode: 1,
      };
    }

    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('fetch failed')) {
      return {
        status: 'SYSTEM_ERROR',
        stderr: 'Execution service is unavailable.',
        exitCode: 1,
      };
    }

    return {
      status: 'SYSTEM_ERROR',
      stderr: `Execution service error: ${errorMsg}`,
      exitCode: 1,
    };
  }
}

/**
 * Normalizes raw Judge0 API JSON response into CodeCollab ExecutionResult format
 * with base64 decoding and output truncation.
 */
function normalizeJudge0Response(data: {
  status?: { id: number; description?: string };
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  time?: string | number | null;
  memory?: number | null;
  exit_code?: number | null;
  message?: string | null;
}): ExecutionResult {
  const statusId = data.status?.id || 13;
  let status: SubmissionStatusType = 'SYSTEM_ERROR';

  switch (statusId) {
    case 3: // Accepted
      status = 'ACCEPTED';
      break;
    case 4: // Wrong Answer
      status = 'WRONG_ANSWER';
      break;
    case 5: // Time Limit Exceeded
      status = 'TIME_LIMIT_EXCEEDED';
      break;
    case 6: // Compilation Error
      status = 'COMPILATION_ERROR';
      break;
    case 7: // SIGSEGV
    case 8: // SIGXFSZ
    case 9: // SIGFPE
    case 10: // SIGABRT
    case 11: // NZEC
    case 12: // Other Runtime Error
      status = 'RUNTIME_ERROR';
      break;
    case 13: // Internal Error
    case 14: // Exec Format Error
    default:
      status = 'SYSTEM_ERROR';
      break;
  }

  const executionTimeMs =
    data.time !== null && data.time !== undefined
      ? Math.round(Number(data.time) * 1000)
      : undefined;

  const memoryUsedMb =
    data.memory !== null && data.memory !== undefined
      ? Math.round((Number(data.memory) / 1024) * 100) / 100
      : undefined;

  const decodedStdout = truncateOutput(decodeBase64(data.stdout));
  const decodedStderr = truncateOutput(decodeBase64(data.stderr) || decodeBase64(data.message));
  const decodedCompileOutput = truncateOutput(decodeBase64(data.compile_output));

  return {
    status,
    stdout: decodedStdout,
    stderr: decodedStderr,
    compileOutput: decodedCompileOutput,
    executionTime: executionTimeMs,
    memory: memoryUsedMb,
    exitCode: data.exit_code ?? (status === 'ACCEPTED' ? 0 : 1),
  };
}
