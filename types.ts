export enum IssueType {
  ERROR = 'Error',
  WARNING = 'Warning',
  SUGGESTION = 'Suggestion'
}

export enum Language {
  JAVASCRIPT = 'javascript',
  TYPESCRIPT = 'typescript',
  PYTHON = 'python',
  JAVA = 'java',
  C = 'c',
  CPP = 'cpp',
  HTML = 'html',
  CSS = 'css',
  UNKNOWN = 'plaintext'
}

export interface Issue {
  line: number;
  type: IssueType;
  message: string;
  fixSuggestion: string;
  suggestedCode?: string;
  category: 'Syntax' | 'Style' | 'Security' | 'Performance' | 'Best Practice';
}

export interface CodeStats {
  cyclomaticComplexity: string; // Low, Medium, High
  maintainabilityIndex: number; // 0-100
  securityScore: number; // 0-100
}

export interface ReviewReport {
  id: string;
  fileName: string;
  timestamp: number;
  language: Language;
  originalCode: string;
  score: number; // 0-100
  summary: string;
  issues: Issue[];
  stats: CodeStats;
  badges: string[]; // e.g., "Secure", "Clean Code", "Spaghetti"
}

export interface HistoryItem {
  id: string;
  fileName: string;
  timestamp: number;
  score: number;
  language: Language;
}