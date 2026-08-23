/**
 * Utility function for safe, normalized code execution output comparison.
 * Trims leading/trailing whitespace, normalizes CRLF line endings to LF (\r\n -> \n),
 * normalizes comma spacing in array/JSON representations, and performs line-by-line comparison.
 */
export function normalizeOutput(output: string | null | undefined): string {
  if (!output) return '';
  return output
    .replace(/\r\n/g, '\n') // Normalize CRLF line endings
    .replace(/\r/g, '\n')   // Normalize CR line endings
    .replace(/,\s*/g, ', ')  // Normalize comma formatting (e.g. [0,1] -> [0, 1])
    .trim();                // Trim surrounding whitespace
}

export function compareOutputs(actual: string, expected: string): boolean {
  const normalizedActual = normalizeOutput(actual);
  const normalizedExpected = normalizeOutput(expected);

  // Direct string equality
  if (normalizedActual === normalizedExpected) {
    return true;
  }

  // Line-by-line comparison ignoring trailing line whitespace
  const actualLines = normalizedActual.split('\n').map((l) => l.trimEnd());
  const expectedLines = normalizedExpected.split('\n').map((l) => l.trimEnd());

  if (actualLines.length !== expectedLines.length) {
    return false;
  }

  for (let i = 0; i < actualLines.length; i++) {
    if (actualLines[i] !== expectedLines[i]) {
      return false;
    }
  }

  return true;
}
