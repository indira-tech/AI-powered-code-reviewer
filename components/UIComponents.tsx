import React, { useEffect, useRef } from 'react';
import { Language, Issue } from '../types';

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-md border border-gray-200 dark:border-slate-700 overflow-hidden transition-all ${className}`}>
    {children}
  </div>
);

export const Badge: React.FC<{ type: string; children: React.ReactNode }> = ({ type, children }) => {
  let colorClass = 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-gray-300';
  
  switch (type.toLowerCase()) {
    case 'error':
    case 'high':
    case 'security':
    case 'security risk':
      colorClass = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800';
      break;
    case 'warning':
    case 'medium':
    case 'performance':
      colorClass = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
      break;
    case 'suggestion':
    case 'low':
    case 'style':
    case 'best practice':
      colorClass = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800';
      break;
    case 'success':
    case 'clean code':
    case 'secure':
    case 'fixed':
    case 'perfection':
      colorClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
      break;
    case 'language':
      colorClass = 'bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-gray-200 border border-gray-300 dark:border-slate-600';
      break;
    default:
      colorClass = 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600';
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {children}
    </span>
  );
};

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline', size?: 'sm' | 'md' }> = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  className = '', 
  ...props 
}) => {
  const baseStyle = "rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2"
  };

  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 focus:ring-indigo-500 border border-transparent",
    secondary: "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 focus:ring-slate-500 dark:bg-white dark:text-slate-900 dark:hover:bg-gray-100",
    outline: "bg-transparent hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-600 focus:ring-indigo-500"
  };

  return (
    <button className={`${baseStyle} ${sizeStyles[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', ...props }) => (
  <div className="relative">
    <select 
      className={`appearance-none bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-gray-100 rounded-lg py-2 pl-3 pr-8 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer ${className}`}
      {...props}
    />
    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  </div>
);

export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };
  return (
    <svg className={`animate-spin ${sizes[size]} text-indigo-500`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
};

export const StatBox: React.FC<{ label: string; value: string | number | React.ReactNode; color?: string; tooltip?: string; children?: React.ReactNode }> = ({ label, value, color = "text-gray-900 dark:text-white", tooltip, children }) => (
  <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col justify-between group relative h-full hover:shadow-lg transition-shadow">
    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
      {label}
      {tooltip && (
         <div className="relative group/tooltip inline-block ml-1">
           <svg className="w-3 h-3 cursor-help text-gray-400 hover:text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
           <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1.5 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
             {tooltip}
             <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
           </div>
         </div>
      )}
    </div>
    {children ? children : <div className={`text-2xl font-bold ${color}`}>{value}</div>}
  </div>
);

export const CodeEditor: React.FC<{ value: string; onChange: (v: string) => void; language: string; theme: string; issues?: Issue[] }> = ({ value, onChange, language, theme, issues = [] }) => {
  const editorRef = useRef<any>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!elementRef.current || !window.ace) return;

    const editor = window.ace.edit(elementRef.current);
    editorRef.current = editor;
    editor.setTheme(theme === 'dark' ? "ace/theme/tomorrow_night_eighties" : "ace/theme/chrome");
    
    const aceLang = language === 'cpp' ? 'c_cpp' : language;
    editor.session.setMode(`ace/mode/${aceLang}`);
    
    editor.setOptions({
      fontSize: "14px",
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      showPrintMargin: false,
      showGutter: true,
      highlightActiveLine: true,
      wrap: true,
    });

    editor.on('change', () => {
      onChange(editor.getValue());
    });

    return () => {
      editor.destroy();
    };
  }, []); // Init only once

  // Update value
  useEffect(() => {
    if (editorRef.current) {
      const currentVal = editorRef.current.getValue();
      if (currentVal !== value) {
        editorRef.current.setValue(value, 1);
      }
    }
  }, [value]);

  // Update theme/mode
  useEffect(() => {
    if (editorRef.current) {
       editorRef.current.setTheme(theme === 'dark' ? "ace/theme/tomorrow_night_eighties" : "ace/theme/chrome");
       const aceLang = language === 'cpp' ? 'c_cpp' : language;
       editorRef.current.session.setMode(`ace/mode/${aceLang}`);
    }
  }, [language, theme]);

  // Handle Issues (Markers & Annotations)
  useEffect(() => {
    if (editorRef.current && issues) {
      const session = editorRef.current.session;
      
      // Clear existing
      const markers = session.getMarkers();
      if (markers) {
        Object.keys(markers).forEach(id => session.removeMarker(id));
      }
      session.clearAnnotations();

      // Inject CSS for markers if not exists
      if (!document.getElementById('ace-marker-styles')) {
         const style = document.createElement('style');
         style.id = 'ace-marker-styles';
         style.innerHTML = `
           .ace_marker-error { position: absolute; background: rgba(239, 68, 68, 0.2); z-index: 20; }
           .ace_marker-warning { position: absolute; background: rgba(245, 158, 11, 0.2); z-index: 20; }
           .ace_marker-suggestion { position: absolute; background: rgba(99, 102, 241, 0.2); z-index: 20; } /* Changed to indigo */
         `;
         document.head.appendChild(style);
      }

      const annotations: any[] = [];

      issues.forEach(issue => {
         const row = issue.line - 1;
         // Markers (Background)
         const Range = window.ace.require("ace/range").Range;
         const markerClass = issue.type === 'Error' ? 'ace_marker-error' : issue.type === 'Warning' ? 'ace_marker-warning' : 'ace_marker-suggestion';
         session.addMarker(new Range(row, 0, row, 1), markerClass, "fullLine");

         // Annotations (Gutter icons & tooltip)
         annotations.push({
           row: row,
           column: 0,
           text: `${issue.type}: ${issue.message}`,
           type: issue.type.toLowerCase() === 'suggestion' ? 'info' : issue.type.toLowerCase() // error, warning, info
         });
      });

      session.setAnnotations(annotations);
    }
  }, [issues]);

  return <div ref={elementRef} className="w-full h-full min-h-[500px]" />;
};