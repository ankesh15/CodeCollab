import React, { useRef, useEffect } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';

interface RemoteCursorInfo {
  lineNumber: number;
  column: number;
  username?: string;
}

interface CodeEditorProps {
  value: string;
  language: string;
  onChange?: (value: string) => void;
  onCursorChange?: (position: { lineNumber: number; column: number }) => void;
  remoteCursors?: Record<string, RemoteCursorInfo>;
  readOnly?: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  language,
  onChange,
  onCursorChange,
  remoteCursors = {},
  readOnly = false,
}) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monacoRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const decorationsRef = useRef<any>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

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

  // Update remote cursor decorations whenever remoteCursors changes
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const monaco = monacoRef.current;
    const editor = editorRef.current;

    const entries = Object.entries(remoteCursors);
    const newDecorations = entries.map(([userId, pos]) => ({
      range: new monaco.Range(
        pos.lineNumber,
        pos.column,
        pos.lineNumber,
        pos.column + 1
      ),
      options: {
        className: 'bg-sky-500/30 border-l-2 border-sky-400 rounded-none',
        hoverMessage: { value: `Collaborator: ${pos.username || userId}` },
        overviewRuler: {
          color: '#38bdf8',
          position: monaco.editor.OverviewRulerLane.Right,
        },
      },
    }));

    if (typeof editor.createDecorationsCollection === 'function') {
      if (decorationsRef.current) {
        decorationsRef.current.clear();
      }
      decorationsRef.current = editor.createDecorationsCollection(newDecorations);
    } else if (typeof editor.deltaDecorations === 'function') {
      decorationsRef.current = editor.deltaDecorations(
        decorationsRef.current || [],
        newDecorations
      );
    }
  }, [remoteCursors]);

  const handleChange: OnChange = (newValue) => {
    if (onChange && newValue !== undefined) {
      onChange(newValue);
    }
  };

  // Map language string to Monaco editor language
  const monacoLanguage = language === 'cpp' || language === 'c++' ? 'cpp' : language === 'python' ? 'python' : 'javascript';

  const remoteCursorEntries = Object.entries(remoteCursors);

  return (
    <div className="w-full h-full min-h-[450px] relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl flex flex-col">
      <div className="flex-1 relative">
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

      {/* Remote Collaborator Cursors Bar */}
      {remoteCursorEntries.length > 0 && (
        <div className="px-3 py-1.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono shrink-0">
          <span className="text-sky-400 font-semibold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            Collaborators:
          </span>
          {remoteCursorEntries.map(([userId, pos]) => (
            <span
              key={userId}
              className="bg-slate-800 px-2 py-0.5 rounded text-slate-300 border border-slate-700"
            >
              {pos.username || userId.slice(0, 6)}: Ln {pos.lineNumber}, Col {pos.column}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
