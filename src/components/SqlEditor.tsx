/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';

interface SqlEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export default function SqlEditor({ value, onChange, placeholder = '', readOnly = false }: SqlEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);
  const lineNumbersRef = useRef<HTMLDivElement | null>(null);

  // Sync scroll positions between textarea, highlighted pre, and line numbers sidebar
  const handleScroll = () => {
    if (textareaRef.current) {
      const scrollTop = textareaRef.current.scrollTop;
      const scrollLeft = textareaRef.current.scrollLeft;

      if (preRef.current) {
        preRef.current.scrollTop = scrollTop;
        preRef.current.scrollLeft = scrollLeft;
      }
      if (lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = scrollTop;
      }
    }
  };

  useEffect(() => {
    // Initial sync
    handleScroll();
  }, [value]);

  const tokenizeAndHighlight = (text: string): string => {
    const keywords = new Set([
      'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'INSERT', 'UPDATE', 'DELETE',
      'CREATE', 'DROP', 'ALTER', 'TABLE', 'VIEW', 'INDEX', 'PROCEDURE', 'PROC',
      'INTO', 'VALUES', 'SET', 'JOIN', 'LEFT', 'RIGHT', 'ON', 'GROUP', 'BY',
      'ORDER', 'LIMIT', 'OFFSET', 'UNION', 'ALL', 'AS', 'PRIMARY', 'KEY', 'FOREIGN',
      'REFERENCES', 'INTEGER', 'TEXT', 'REAL', 'NOT', 'NULL', 'DEFAULT', 'PRAGMA',
      'STRFTIME', 'SUM', 'AVG', 'MIN', 'MAX', 'COUNT', 'BEGIN', 'END', 'WITH', 'EXEC'
    ]);

    // Escape HTML tags to prevent broken nodes
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // RegExp tokenizer for comments (--), strings ('...'), words (keywords/identifiers), and numbers
    const tokenRegex = /(\-\-.*$)|('(?:''|[^'])*')|([a-zA-Z_][a-zA-Z0-9_]*)|(\d+(?:\.\d+)?)|([^\s\w]+)/gm;

    return escaped.replace(tokenRegex, (match, comment, str, word, num) => {
      if (comment) {
        return `<span class="text-slate-500 italic">${match}</span>`;
      }
      if (str) {
        return `<span class="text-green-400 font-semibold">${match}</span>`;
      }
      if (word) {
        const upperWord = word.toUpperCase();
        if (keywords.has(upperWord)) {
          return `<span class="text-purple-400 font-semibold">${upperWord}</span>`; // Purple for SQL keywords
        }
        return `<span class="text-[#c9d1d9]">${match}</span>`;
      }
      if (num) {
        return `<span class="text-orange-400">${match}</span>`;
      }
      return `<span class="text-[#8b949e]">${match}</span>`;
    });
  };

  const lines = value.split('\n');

  return (
    <div className="relative flex bg-[#0d1117] border border-[#30363d] rounded h-48 overflow-hidden font-mono text-[11px] leading-relaxed w-full">
      {/* Line numbers column */}
      <div
        ref={lineNumbersRef}
        className="select-none text-right pr-2.5 pl-3 text-[#8b949e] border-r border-[#30363d] bg-[#161b22] py-2 shrink-0 overflow-hidden text-[11px] leading-[18px] h-full"
      >
        {lines.map((_, i) => (
          <div key={i} className="h-[18px] h-min">
            {i + 1}
          </div>
        ))}
      </div>

      {/* Editor viewport */}
      <div className="relative flex-1 h-full overflow-hidden">
        {/* Hidden underlying/overlayed highlighted rendering */}
        <pre
          ref={preRef}
          aria-hidden="true"
          className="absolute inset-0 w-full h-full p-2 m-0 bg-transparent pointer-events-none whitespace-pre overflow-auto font-mono text-[11px] leading-[18px] text-[#c9d1d9] z-0 scrollbar-none"
          dangerouslySetInnerHTML={{ __html: tokenizeAndHighlight(value) }}
        />

        {/* Editable transparent input textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          readOnly={readOnly}
          placeholder={placeholder}
          className="absolute inset-0 w-full h-full p-2 m-0 bg-transparent text-transparent caret-blue-500 resize-none whitespace-pre overflow-auto font-mono text-[11px] leading-[18px] outline-none border-none z-10 focus:ring-0 focus:outline-none"
          spellCheck="false"
        />
      </div>
    </div>
  );
}
