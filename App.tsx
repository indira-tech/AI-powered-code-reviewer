import React, { useState, useEffect, useRef } from 'react';
import { analyzeCode } from './services/geminiService';
import { ReviewReport, Language, HistoryItem, Issue } from './types';
import { Card, Badge, Button, Select, Spinner, StatBox, CodeEditor } from './components/UIComponents';
import { detectLanguage, getHistory, saveToHistory, downloadReport } from './utils/helpers';

// Helper to highlight code using Prism
declare global {
  interface Window {
    Prism: any;
    ace: any;
  }
}

const App: React.FC = () => {
  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState<Language>(Language.JAVASCRIPT);
  const [fileName, setFileName] = useState<string>('snippet.js');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<ReviewReport | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<'editor' | 'report'>('editor');
  const [fixedIssueIndices, setFixedIssueIndices] = useState<Set<number>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  
  // State for connectivity
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [analysisMode, setAnalysisMode] = useState<'offline' | 'online'>(navigator.onLine ? 'online' : 'offline');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHistory(getHistory());
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // --- NETWORK CONNECTIVITY HANDLER ---
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setAnalysisMode('online');
    };
    const handleOffline = () => {
      setIsOnline(false);
      setAnalysisMode('offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Helper to map Language enum to a common file extension
  const getFileExtension = (lang: Language): string => {
    switch (lang) {
        case Language.JAVASCRIPT: return 'js';
        case Language.TYPESCRIPT: return 'ts';
        case Language.PYTHON: return 'py';
        case Language.JAVA: return 'java';
        case Language.C: return 'c';
        case Language.CPP: return 'cpp';
        case Language.HTML: return 'html';
        case Language.CSS: return 'css';
        default: return 'txt';
    }
  };

  // --- SMART AUTO-DETECT ---
  useEffect(() => {
    if (code.trim()) {
      const isScratchpad = fileName.startsWith('snippet.') || fileName === 'snippet.js';
      const nameForDetection = isScratchpad ? '' : fileName;
      const detectedLang = detectLanguage(nameForDetection, code);
      
      if (detectedLang !== language && detectedLang !== Language.UNKNOWN) {
        setLanguage(detectedLang);
        if (isScratchpad) {
           setFileName(`snippet.${getFileExtension(detectedLang)}`);
        }
      }
    }
  }, [code]); 

  useEffect(() => {
    if (window.Prism) {
      window.Prism.highlightAll();
    }
  }, [report, activeTab, code]);

  useEffect(() => {
    if (report) {
      setExpandedCategories({});
    }
  }, [report]);

  const toggleDarkMode = () => setDarkMode(!darkMode);
  
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCode(content);
      const detectedLang = detectLanguage(file.name, content);
      setFileName(file.name);
      setLanguage(detectedLang);
    };
    reader.readAsText(file);
  };

  const handleAnalyze = async () => {
    if (!code.trim()) return;
    
    setIsAnalyzing(true);
    setActiveTab('report');
    setFixedIssueIndices(new Set()); 
    
    try {
      const result = await analyzeCode(code, language, fileName, analysisMode);
      setReport(result);
      const updatedHistory = saveToHistory(result);
      setHistory(updatedHistory);
    } catch (error) {
      console.error(error);
      alert("Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyFix = (indices: number[]) => {
    if (!report || indices.length === 0) return;
    
    const lines = code.split('\n');
    const newFixedIndices = new Set(fixedIssueIndices);
    let codeChanged = false;

    indices.forEach(index => {
      const issue = report.issues[index];
      if (!issue || !issue.suggestedCode || newFixedIndices.has(index)) return;

      const lineIndex = issue.line - 1;
      if (lineIndex >= 0 && lineIndex < lines.length) {
        lines[lineIndex] = issue.suggestedCode;
        newFixedIndices.add(index);
        codeChanged = true;
      }
    });

    if (codeChanged) {
      setCode(lines.join('\n'));
      setFixedIssueIndices(newFixedIndices);
    }
  };

  const handleApplyAllFixes = () => {
    if (!report) return;
    const fixableIndices = report.issues
      .map((issue, index) => (issue.suggestedCode ? index : -1))
      .filter(index => index !== -1);
    
    handleApplyFix(fixableIndices);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        handleAnalyze();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [code, language, analysisMode]);

  const loadHistoryItem = (item: HistoryItem) => {
    alert(`History loaded for: ${item.fileName}. (Full content retrieval requires DB persistence)`);
  };

  // --- ENHANCED SCORE CONFIGURATION ---
  const getScoreConfig = (score: number) => {
    if (score >= 97) return { 
        grade: 'A+',
        text: 'text-emerald-600 dark:text-emerald-400', 
        bg: 'bg-emerald-500', 
        ring: 'stroke-emerald-500',
        label: 'Elite Code',
        subtext: 'Exceptional quality. Ready for production.'
    };
    if (score >= 90) return { 
        grade: 'A',
        text: 'text-emerald-500 dark:text-emerald-400', 
        bg: 'bg-emerald-500', 
        ring: 'stroke-emerald-500',
        label: 'Excellent',
        subtext: 'High quality code with minimal issues.'
    };
    if (score >= 80) return { 
        grade: 'B',
        text: 'text-indigo-500 dark:text-indigo-400', 
        bg: 'bg-indigo-500', 
        ring: 'stroke-indigo-500',
        label: 'Good',
        subtext: 'Solid code, minor improvements recommended.'
    };
    if (score >= 70) return { 
        grade: 'C',
        text: 'text-amber-500 dark:text-amber-400', 
        bg: 'bg-amber-500', 
        ring: 'stroke-amber-500',
        label: 'Average',
        subtext: 'Functional but needs refactoring.'
    };
    if (score >= 60) return { 
        grade: 'D',
        text: 'text-orange-500 dark:text-orange-400', 
        bg: 'bg-orange-500', 
        ring: 'stroke-orange-500',
        label: 'Poor',
        subtext: 'Significant issues that affect stability.'
    };
    return { 
        grade: 'F',
        text: 'text-rose-500 dark:text-rose-400', 
        bg: 'bg-rose-500', 
        ring: 'stroke-rose-500',
        label: 'Critical',
        subtext: 'Immediate attention required. Do not deploy.'
    };
  };

  const getGroupedIssues = () => {
    if (!report) return null;
    const groups: Record<string, { issue: Issue, index: number }[]> = {};
    report.issues.forEach((issue, index) => {
        const category = issue.category || 'Best Practice';
        if (!groups[category]) groups[category] = [];
        groups[category].push({ issue, index });
    });
    return groups;
  };

  const canApplyAll = report && 
                      report.issues.some(i => i.suggestedCode) && 
                      fixedIssueIndices.size === 0;

  const groupedIssues = getGroupedIssues();
  const categoryOrder = ['Security', 'Syntax', 'Performance', 'Best Practice', 'Style'];
  
  const sortedCategories = groupedIssues ? Object.keys(groupedIssues).sort((a, b) => {
      const indexA = categoryOrder.indexOf(a);
      const indexB = categoryOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
  }) : [];

  const hasExpandedCategories = Object.values(expandedCategories).some(isOpen => isOpen);

  const getCategoryColor = (cat: string) => {
    switch(cat) {
      case 'Security': return 'border-rose-500 text-rose-600 dark:text-rose-400';
      case 'Syntax': return 'border-orange-500 text-orange-600 dark:text-orange-400';
      case 'Performance': return 'border-violet-500 text-violet-600 dark:text-violet-400';
      case 'Best Practice': return 'border-indigo-500 text-indigo-600 dark:text-indigo-400';
      default: return 'border-slate-500 text-slate-600 dark:text-slate-400';
    }
  };

  const getComplexityColor = (level: string) => {
    if (level === 'High') return 'bg-rose-500';
    if (level === 'Medium') return 'bg-amber-500';
    return 'bg-emerald-500'; 
  };

  return (
    <div className={`h-screen flex flex-col ${darkMode ? 'dark' : ''}`}>
      {/* Toolbar */}
      <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between z-20 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-lg shadow-lg shadow-indigo-500/30 flex items-center justify-center text-white font-bold text-lg">
            AI
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300">
            powered code reviewer <span className="text-xs font-medium text-indigo-500 dark:text-indigo-400 uppercase tracking-widest ml-1">AI</span>
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-lg p-1 border border-gray-200 dark:border-slate-700">
             <button 
                onClick={() => setAnalysisMode('offline')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${analysisMode === 'offline' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
             >
               Offline
             </button>
             <button 
                onClick={() => isOnline && setAnalysisMode('online')}
                disabled={!isOnline}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 
                  ${analysisMode === 'online' 
                    ? 'bg-indigo-600 shadow-lg shadow-indigo-500/30 text-white' 
                    : isOnline 
                      ? 'text-gray-500 hover:text-gray-700 dark:text-gray-400' 
                      : 'text-gray-300 dark:text-slate-600 cursor-not-allowed opacity-50'
                  }`}
                title={!isOnline ? "No internet connection available" : "Switch to AI Cloud"}
             >
               <span>AI Cloud</span>
               {isOnline ? (
                 <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75 animate-ping-slow"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                 </span>
               ) : (
                 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
               )}
             </button>
          </div>

          <button 
            onClick={toggleDarkMode}
            className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800 transition-colors"
            title="Toggle Theme"
          >
            {darkMode ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 24.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden bg-gray-50 dark:bg-slate-900 flex">
        {/* Editor Section */}
        <section className="w-1/2 flex flex-col border-r border-gray-200 dark:border-slate-800">
          {/* Controls */}
          <div className="p-4 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex items-center gap-3 shrink-0">
             <div className="flex-1 flex gap-3 items-center">
               <input 
                 ref={fileInputRef}
                 type="file" 
                 className="hidden" 
                 onChange={handleFileUpload} 
               />
               <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                 Upload
               </Button>
             </div>
             <Select 
               value={language} 
               onChange={(e) => setLanguage(e.target.value as Language)}
               className="w-36 text-sm"
             >
                {Object.values(Language).map(l => (
                  <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                ))}
             </Select>
             <Button 
               onClick={handleAnalyze} 
               disabled={isAnalyzing || !code.trim()}
               size="sm"
               variant="primary"
               className="min-w-[140px]"
             >
               {isAnalyzing ? <Spinner size="sm" /> : (
                 <>
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                   Analyze Code
                 </>
               )}
             </Button>
          </div>
          
          {/* Code Editor */}
          <div className="flex-1 relative">
            <CodeEditor 
              value={code} 
              onChange={setCode} 
              language={language} 
              theme={darkMode ? 'dark' : 'light'} 
              issues={report?.issues}
            />
          </div>
        </section>

        {/* Report/History Section */}
        <section className="w-1/2 flex flex-col bg-white dark:bg-slate-950 overflow-y-auto relative scroll-smooth">
          
          {isAnalyzing ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 gap-4 p-8">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 rounded-full animate-pulse-slow"></div>
                <Spinner size="lg" />
              </div>
              <p className="font-medium text-lg">
                {analysisMode === 'online' ? 'Connecting to Gemini AI...' : 'Running Static Analysis...'}
              </p>
              <p className="text-sm text-center max-w-sm text-gray-400">
                Analyzing code for bugs, security risks, and best practices.
              </p>
            </div>
          ) : !report ? (
             <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
               <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-6 border border-gray-200 dark:border-slate-700 shadow-xl">
                 <svg className="w-10 h-10 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
               </div>
               <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Ready to Review</h3>
               <p className="max-w-sm mx-auto text-base">
                 Paste your code to get an instant **Offline** check or a deep **AI-powered** review.
               </p>
               
               {history.length > 0 && (
                 <div className="mt-12 w-full max-w-md">
                   <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 border-b border-gray-200 dark:border-slate-800 pb-2">Recent Reviews</h4>
                   <div className="space-y-3">
                     {history.map((item) => (
                       <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 cursor-pointer hover:border-indigo-400 transition-all" onClick={() => loadHistoryItem(item)}>
                         <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${item.score >= 80 ? 'bg-emerald-500' : item.score >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}></div>
                            <div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.fileName}</span>
                                <span className="block text-xs text-gray-400 uppercase">{item.language}</span>
                            </div>
                         </div>
                         <span className="text-sm font-bold text-gray-500 dark:text-gray-400">{item.score}</span>
                       </div>
                     ))}
                   </div>
                 </div>
               )}
             </div>
          ) : (
            <div className="p-8 pb-20 max-w-6xl mx-auto w-full">
              
              {/* Score Dashboard Header */}
              <div className="flex items-center justify-between mb-8">
                 <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-3">
                      Analysis Report 
                      <span className="text-xs font-normal px-2 py-0.5 rounded border border-gray-200 dark:border-slate-700 text-gray-500 uppercase tracking-wider">
                        {analysisMode} Mode
                      </span>
                    </h2>
                    <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-mono">{report.fileName}</span>
                      <span className="text-gray-300 dark:text-slate-700">•</span>
                      <span>{new Date(report.timestamp).toLocaleString()}</span>
                    </div>
                 </div>
                 <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => downloadReport(report, 'json')}>JSON</Button>
                    <Button variant="outline" size="sm" onClick={() => downloadReport(report, 'pdf')}>PDF</Button>
                 </div>
              </div>

              {/* PROFESSIONAL SCORE CARD LAYOUT */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                
                {/* 1. Quality Score Card */}
                <Card className="col-span-1 relative overflow-hidden border-t-4 border-t-indigo-500 p-0">
                   <div className="p-8 flex flex-col items-center justify-center text-center bg-gradient-to-b from-indigo-50/50 to-transparent dark:from-slate-800/50 h-full">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Overall Quality Score</h3>
                      
                      <div className="relative w-40 h-40 flex items-center justify-center mb-6">
                         {/* Background Circle */}
                         <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                           <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-100 dark:text-slate-800" />
                           {/* Progress Circle */}
                           <circle 
                             cx="50" 
                             cy="50" 
                             r="45" 
                             fill="none" 
                             stroke="currentColor" 
                             strokeWidth="6" 
                             strokeDasharray="283"
                             strokeDashoffset={283 - (283 * report.score) / 100}
                             className={`${getScoreConfig(report.score).text} transition-all duration-1000 ease-out drop-shadow-lg`}
                             strokeLinecap="round"
                           />
                         </svg>
                         {/* Score Text */}
                         <div className="absolute flex flex-col items-center">
                           <span className={`text-5xl font-black tracking-tighter text-gray-900 dark:text-white`}>
                             {report.score}
                           </span>
                           <span className={`text-lg font-bold ${getScoreConfig(report.score).text}`}>
                             {getScoreConfig(report.score).grade}
                           </span>
                         </div>
                      </div>

                      <div className="space-y-1">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getScoreConfig(report.score).bg} bg-opacity-10 ${getScoreConfig(report.score).text} border border-current border-opacity-20`}>
                            {getScoreConfig(report.score).label}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 pt-2 max-w-[200px] mx-auto leading-relaxed">
                          {getScoreConfig(report.score).subtext}
                        </p>
                      </div>
                   </div>
                </Card>

                {/* 2. Summary & Key Stats */}
                <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
                   <Card className="p-6 relative overflow-hidden flex-1">
                     <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                     <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide mb-4 flex items-center gap-2">
                       Executive Summary
                     </h4>
                     <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                       {report.summary}
                     </p>
                     <div className="flex flex-wrap gap-2 mt-6">
                       {report.badges.map(badge => (
                         <Badge key={badge} type={badge}>{badge}</Badge>
                       ))}
                     </div>
                   </Card>

                   {/* Metrics Grid */}
                   <div className="grid grid-cols-3 gap-4">
                      <StatBox 
                          label="Complexity" 
                          value={report.stats.cyclomaticComplexity} 
                          tooltip="Linear independent paths. Lower is better."
                      >
                        <div className="flex items-end gap-1 h-8 mt-2">
                          <div className={`w-2 rounded-sm h-3 ${getComplexityColor(report.stats.cyclomaticComplexity)} opacity-100`}></div>
                          <div className={`w-2 rounded-sm h-5 ${['Medium', 'High'].includes(report.stats.cyclomaticComplexity) ? getComplexityColor(report.stats.cyclomaticComplexity) : 'bg-gray-200 dark:bg-slate-700'}`}></div>
                          <div className={`w-2 rounded-sm h-8 ${report.stats.cyclomaticComplexity === 'High' ? getComplexityColor(report.stats.cyclomaticComplexity) : 'bg-gray-200 dark:bg-slate-700'}`}></div>
                        </div>
                      </StatBox>
                      
                      <StatBox 
                          label="Security" 
                          value={report.stats.securityScore + '/100'} 
                          color={report.stats.securityScore < 80 ? 'text-rose-500' : 'text-emerald-500'}
                          tooltip="Security health based on vulnerability density."
                      />
                      
                      <StatBox 
                          label="Issues Found" 
                          value={report.issues.length} 
                          color="text-gray-900 dark:text-white"
                      />
                   </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mb-8 flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl">
                 <div className="flex items-center gap-4">
                   <div className="p-2.5 bg-indigo-600 rounded-lg text-white shadow-lg shadow-indigo-500/20">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                   </div>
                   <div>
                     <h4 className="font-bold text-gray-900 dark:text-white">One-Click Fixes</h4>
                     <p className="text-sm text-gray-500 dark:text-gray-400">Automatically apply suggestions to {report.issues.filter(i => i.suggestedCode).length} issues.</p>
                   </div>
                 </div>
                 <Button 
                    onClick={handleApplyAllFixes} 
                    disabled={!canApplyAll}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white border-none px-6"
                  >
                    Fix All Issues
                  </Button>
              </div>

              {/* Grouped Issues */}
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Detailed Findings</h3>
                  {hasExpandedCategories && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setExpandedCategories({})}
                      className="h-8 text-xs px-3"
                    >
                      Collapse All
                    </Button>
                  )}
                </div>
                
                {sortedCategories.length === 0 && (
                   <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl">
                     <p className="text-gray-500 dark:text-gray-400">No issues found. Great job!</p>
                   </div>
                )}

                {sortedCategories.map((category) => {
                  const categoryIssues = groupedIssues ? groupedIssues[category] : [];
                  const isExpanded = expandedCategories[category];

                  return (
                    <div key={category} className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800/40 shadow-sm hover:shadow-md transition-shadow duration-200">
                      {/* Collapsible Header */}
                      <button 
                        onClick={() => toggleCategory(category)}
                        className={`w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors border-l-4 ${getCategoryColor(category).split(' ')[0]}`}
                      >
                        <div className="flex items-center gap-3">
                          <h4 className={`font-bold text-sm uppercase tracking-wide ${getCategoryColor(category).split(' ')[1]}`}>{category}</h4>
                          <span className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-gray-200 dark:border-slate-600">
                            {categoryIssues.length}
                          </span>
                        </div>
                        <svg 
                          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'transform rotate-180' : ''}`} 
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {/* Issues List */}
                      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="p-4 space-y-4 bg-gray-50/50 dark:bg-slate-900/20 border-t border-gray-100 dark:border-slate-700">
                          {categoryIssues.map(({ issue, index }) => {
                            const isFixed = fixedIssueIndices.has(index);
                            return (
                              <Card key={index} className={`p-5 border-l-4 ${issue.type === 'Error' ? 'border-l-rose-500' : issue.type === 'Warning' ? 'border-l-amber-500' : 'border-l-indigo-500'}`}>
                                <div className="flex items-start justify-between gap-6">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                      <Badge type={issue.type}>{issue.type}</Badge>
                                      <span className="text-xs font-mono text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded">Line {issue.line}</span>
                                      {isFixed && <Badge type="Success">Fixed</Badge>}
                                    </div>
                                    <p className="text-gray-800 dark:text-gray-200 font-medium text-base mb-3 leading-relaxed">{issue.message}</p>
                                    <div className="bg-white dark:bg-slate-900 p-4 rounded-lg text-sm font-mono text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700 shadow-sm relative group">
                                      <span className="text-indigo-500 font-bold mr-2 select-none">Suggestion:</span>
                                      {issue.fixSuggestion}
                                    </div>
                                    
                                    {/* Visual Diff if fixed */}
                                    {isFixed && issue.suggestedCode && (
                                      <div className="mt-4 grid grid-cols-1 gap-2 animate-fade-in">
                                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Applied Fix</div>
                                        <div className="text-xs font-mono bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 p-3 rounded border border-emerald-100 dark:border-emerald-900/30">
                                          {issue.suggestedCode}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {issue.suggestedCode && !isFixed && (
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      onClick={() => handleApplyFix([index])}
                                      className="shrink-0 self-start"
                                    >
                                      Fix Issue
                                    </Button>
                                  )}
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default App;