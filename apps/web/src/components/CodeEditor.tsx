import React, { useRef } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';

interface CodeEditorProps {
  value: string;
  language: string;
  onChange?: (value: string) => void;
  onCursorChange?: (position: { lineNumber: number; column: number }) => void;
  readOnly?: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  language,
  onChange,
  onCursorChange,
  readOnly = false,
}) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Define custom dark glassmorphic theme matching CodeCollab design system
    monaco.editor.defineTheme('codecollab-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
        { token: 'keyword', foreground: '38bdf8', fontStyle: 'bold' },
        { token: 'string', foreground: '34d399' },
        { token: 'number', foreground: 'f472b6' },
        { token: 'type', foreground: 'a78bfa' },
      ],
      colors: {
        'editor.background': '#0f172a',
        'editor.foreground': '#f8fafc',
        'editor.lineHighlightBackground': '#1e293b50',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#38bdf8',
        'editorCursor.foreground': '#38bdf8',
        'editor.selectionBackground': '#38bdf833',
        'editorWidget.background': '#1e293b',
        'editorWidget.border': '#334155',
      },
    });

    monaco.editor.setTheme('codecollab-dark');

    // Cursor position listener
    editor.onDidChangeCursorPosition((e) => {
      if (onCursorChange) {
        onCursorChange({
          lineNumber: e.position.lineNumber,
          column: e.position.column,
        });
      }
    });
  };

  const handleChange: OnChange = (newValue) => {
    if (onChange && newValue !== undefined) {
      onChange(newValue);
    }
  };

  // Map language string to Monaco editor language
  const monacoLanguage = language === 'cpp' || language === 'c++' ? 'cpp' : language === 'python' ? 'python' : 'javascript';

  return (
    <div className="w-full h-full min-h-[450px] relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl flex flex-col">
      <Editor
        height="100%"
        language={monacoLanguage}
        value={value}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        options={{
          readOnly,
          minimap: { enabled: true },
          fontSize: 14,
          fontFamily: "'Fira Code', 'Courier New', monospace",
          lineNumbers: 'on',
          roundedSelection: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 16, bottom: 16 },
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
        }}
        loading={
          <div className="flex items-center justify-center h-full text-slate-400 font-mono text-sm">
            <span className="inline-block animate-spin mr-2">⚡</span> Loading Monaco Editor...
          </div>
        }
      />
    </div>
  );
};
