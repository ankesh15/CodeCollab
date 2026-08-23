export interface LanguageConfig {
  id: string;
  name: string;
  judge0Id: number;
  monacoLanguage: string;
  extension: string;
}

export const SUPPORTED_LANGUAGES: Record<string, LanguageConfig> = {
  cpp: {
    id: 'cpp',
    name: 'C++ (GCC 13)',
    judge0Id: 54, // C++ (GCC 9.2.0) / 75 in Judge0 CE
    monacoLanguage: 'cpp',
    extension: 'cpp',
  },
  javascript: {
    id: 'javascript',
    name: 'JavaScript (Node.js 20)',
    judge0Id: 63, // JavaScript (Node.js 12.14.0) / 93 in Judge0 CE
    monacoLanguage: 'javascript',
    extension: 'js',
  },
  python: {
    id: 'python',
    name: 'Python (3.11)',
    judge0Id: 71, // Python (3.8.1) / 92 in Judge0 CE
    monacoLanguage: 'python',
    extension: 'py',
  },
};

export function getLanguageConfig(lang: string): LanguageConfig | null {
  const normalized = lang.toLowerCase().trim();
  return SUPPORTED_LANGUAGES[normalized] || null;
}
