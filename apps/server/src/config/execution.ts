export const EXECUTION_CONFIG = {
  // Source Code Limits
  MAX_CODE_SIZE_BYTES: 64 * 1024, // 64 KB maximum source code size
  MAX_STDIN_SIZE_BYTES: 64 * 1024, // 64 KB maximum stdin size
  MAX_TEST_CASES_PER_SUBMISSION: 50, // Maximum test cases evaluated per submission

  // Sandbox Limits
  MAX_EXECUTION_TIME_MS: 5000, // 5 seconds CPU time limit
  MAX_MEMORY_MB: 128, // 128 MB memory limit
  MAX_OUTPUT_BYTES: 10 * 1024, // 10 KB maximum stdout/stderr output size

  // Code Runner Endpoint & Settings
  RUNNER_URL: process.env.CODE_RUNNER_URL || 'https://ce.judge0.com',
  RUNNER_API_KEY: process.env.CODE_RUNNER_API_KEY || '',
  RUNNER_TIMEOUT_MS: 10000, // HTTP timeout when calling runner service
} as const;
