import { GoogleGenAI, Type } from "@google/genai";
import { ReviewReport, Language, Issue, IssueType } from "../types";

// --- OFFLINE RULES CONFIGURATION ---

interface Rule {
  id: string;
  regex: RegExp;
  type: IssueType;
  message: string;
  fixSuggestion: string;
  category: 'Syntax' | 'Style' | 'Security' | 'Performance' | 'Best Practice';
  suggestedCode?: (match: RegExpMatchArray, line: string) => string | undefined;
}

const COMMON_RULES: Rule[] = [
  {
    id: 'todo',
    regex: /(\/\/|#|\/\*|<!--)\s*(TODO|FIXME)/i,
    type: IssueType.SUGGESTION,
    message: "TODO/FIXME comment detected.",
    fixSuggestion: "Review and implement the pending task.",
    category: 'Best Practice'
  },
  {
    id: 'long-line',
    regex: /^.{120,}$/,
    type: IssueType.SUGGESTION,
    message: "Line exceeds 120 characters.",
    fixSuggestion: "Break this line to improve readability.",
    category: 'Style'
  },
  {
    id: 'hardcoded-secret',
    regex: /['"](AIza|sk-|ghp_|ey[A-Za-z0-9-_]{30,})[a-zA-Z0-9_\-]*['"]/,
    type: IssueType.ERROR,
    message: "Potential hardcoded secret or API key detected.",
    fixSuggestion: "Use environment variables (e.g., process.env.KEY) instead of hardcoding secrets.",
    category: 'Security'
  },
  {
    id: 'trailing-whitespace',
    regex: /\s+$/,
    type: IssueType.SUGGESTION,
    message: "Trailing whitespace detected.",
    fixSuggestion: "Remove unnecessary whitespace at the end of the line.",
    category: 'Style',
    suggestedCode: (match, line) => line.trimEnd()
  }
];

const JS_TS_RULES: Rule[] = [
  {
    id: 'console-log',
    regex: /console\.log\s*\(/,
    type: IssueType.WARNING,
    message: "Console.log statement found.",
    fixSuggestion: "Remove debug logging before production.",
    category: 'Best Practice',
    suggestedCode: (match, line) => `// ${line}`
  },
  {
    id: 'var-usage',
    regex: /\bvar\s+([a-zA-Z_$][0-9a-zA-Z_$]*)/,
    type: IssueType.WARNING,
    message: "Usage of 'var' keyword.",
    fixSuggestion: "Use 'let' or 'const' to prevent hoisting issues.",
    category: 'Best Practice',
    suggestedCode: (match, line) => line.replace(/\bvar\b/, 'let')
  },
  {
    id: 'loose-equality',
    regex: /([^=!])==([^=])/,
    type: IssueType.WARNING,
    message: "Loose equality (==) usage.",
    fixSuggestion: "Use strict equality (===) to avoid type coercion.",
    category: 'Best Practice',
    suggestedCode: (match, line) => line.replace(/==/, '===')
  },
  {
    id: 'eval-usage',
    regex: /\beval\s*\(/,
    type: IssueType.ERROR,
    message: "Dangerous 'eval()' function detected.",
    fixSuggestion: "Remove 'eval()' as it poses a severe security risk.",
    category: 'Security'
  },
  {
    id: 'debugger',
    regex: /\bdebugger;?/,
    type: IssueType.WARNING,
    message: "Debugger statement found.",
    fixSuggestion: "Remove debugger statements.",
    category: 'Best Practice',
    suggestedCode: (match, line) => ""
  },
  {
    id: 'empty-catch',
    regex: /catch\s*\([^)]*\)\s*\{\s*\}/,
    type: IssueType.WARNING,
    message: "Empty catch block detected.",
    fixSuggestion: "Handle the error or log it; do not swallow exceptions silently.",
    category: 'Best Practice'
  }
];

const PYTHON_RULES: Rule[] = [
  {
    id: 'print-stmt',
    regex: /^\s*print\s*\(/,
    type: IssueType.WARNING,
    message: "Print statement found.",
    fixSuggestion: "Remove print statements or use a logger.",
    category: 'Best Practice',
    suggestedCode: (match, line) => `# ${line}`
  },
  {
    id: 'bare-except',
    regex: /except:/,
    type: IssueType.WARNING,
    message: "Bare 'except' clause detected.",
    fixSuggestion: "Catch specific exceptions (e.g., 'except ValueError:') to avoid hiding bugs.",
    category: 'Best Practice',
    suggestedCode: (match, line) => line.replace('except:', 'except Exception:')
  },
  {
    id: 'exec-usage',
    regex: /\bexec\s*\(/,
    type: IssueType.ERROR,
    message: "Dangerous 'exec()' function detected.",
    fixSuggestion: "Avoid dynamic code execution.",
    category: 'Security'
  }
];

const JAVA_RULES: Rule[] = [
  {
    id: 'system-out',
    regex: /System\.out\.print/,
    type: IssueType.WARNING,
    message: "System.out.print usage.",
    fixSuggestion: "Use a proper logging framework like SLF4J or Log4j.",
    category: 'Best Practice'
  },
  {
    id: 'generic-exception',
    regex: /catch\s*\(\s*Exception\s+\w+\s*\)/,
    type: IssueType.WARNING,
    message: "Generic Exception catch.",
    fixSuggestion: "Catch specific exceptions to handle errors properly.",
    category: 'Best Practice'
  },
  {
    id: 'empty-catch-java',
    regex: /catch\s*\([^)]*\)\s*\{\s*\}/,
    type: IssueType.WARNING,
    message: "Empty catch block detected.",
    fixSuggestion: "Handle the error or log it.",
    category: 'Best Practice'
  }
];

const CPP_RULES: Rule[] = [
  {
    id: 'using-namespace-std',
    regex: /using\s+namespace\s+std;/,
    type: IssueType.WARNING,
    message: "Global 'using namespace std' detected.",
    fixSuggestion: "Use specific imports (e.g., 'using std::cout;') or prefix with 'std::' to avoid namespace pollution.",
    category: 'Best Practice'
  },
  {
    id: 'goto-usage',
    regex: /\bgoto\s+\w+;/,
    type: IssueType.WARNING,
    message: "'goto' statement detected.",
    fixSuggestion: "Avoid 'goto' as it leads to unmaintainable 'spaghetti code'. Use loops or functions instead.",
    category: 'Best Practice'
  },
  {
    id: 'malloc-usage',
    regex: /\bmalloc\s*\(/,
    type: IssueType.SUGGESTION,
    message: "C-style memory allocation detected in C++ context.",
    fixSuggestion: "Use 'new' or smart pointers (std::unique_ptr, std::shared_ptr) for better safety.",
    category: 'Best Practice'
  },
  {
    id: 'unsafe-functions',
    regex: /\b(strcpy|strcat|sprintf|gets)\s*\(/,
    type: IssueType.ERROR,
    message: "Unsafe C string function detected.",
    fixSuggestion: "Use safer alternatives like 'strncpy', 'snprintf', or C++ std::string to prevent buffer overflows.",
    category: 'Security'
  }
];

const HTML_RULES: Rule[] = [
  {
    id: 'img-alt',
    regex: /<img\s+(?![^>]*\balt=)[^>]*>/,
    type: IssueType.WARNING,
    message: "Image tag missing 'alt' attribute.",
    fixSuggestion: "Add an 'alt' attribute for accessibility.",
    category: 'Best Practice'
  },
  {
    id: 'inline-style',
    regex: /style\s*=\s*["'][^"']*["']/,
    type: IssueType.SUGGESTION,
    message: "Inline style detected.",
    fixSuggestion: "Move styles to an external CSS file or <style> block for better maintainability.",
    category: 'Style'
  },
  {
    id: 'missing-doctype',
    regex: /^<html/,
    type: IssueType.ERROR,
    message: "Missing DOCTYPE declaration.",
    fixSuggestion: "Add '<!DOCTYPE html>' at the beginning of the file to ensure standards mode.",
    category: 'Best Practice',
    suggestedCode: (match, line) => `<!DOCTYPE html>\n${line}`
  }
];

const CSS_RULES: Rule[] = [
  {
    id: 'important-usage',
    regex: /!important/,
    type: IssueType.WARNING,
    message: "Use of '!important' detected.",
    fixSuggestion: "Avoid '!important' as it makes overriding styles difficult. Use higher specificity instead.",
    category: 'Best Practice'
  },
  {
    id: 'id-selector',
    regex: /#\w+\s*\{/,
    type: IssueType.SUGGESTION,
    message: "ID selector used for styling.",
    fixSuggestion: "Prefer class selectors (.) over ID selectors (#) for reusability.",
    category: 'Best Practice'
  }
];

// --- OFFLINE ANALYSIS ENGINE ---

const analyzeCodeOffline = async (code: string, language: Language, fileName: string): Promise<ReviewReport> => {
  // Simulate processing time for UX
  await new Promise(resolve => setTimeout(resolve, 600));

  if (!code.trim()) {
    return createEmptyReport(fileName, language, code);
  }

  const lines = code.split('\n');
  const issues: Issue[] = [];
  
  // Determine active ruleset
  let rules = [...COMMON_RULES];
  switch (language) {
    case Language.JAVASCRIPT:
    case Language.TYPESCRIPT:
      rules = [...rules, ...JS_TS_RULES];
      break;
    case Language.PYTHON:
      rules = [...rules, ...PYTHON_RULES];
      break;
    case Language.JAVA:
      rules = [...rules, ...JAVA_RULES];
      break;
    case Language.C:
    case Language.CPP:
      rules = [...rules, ...CPP_RULES];
      break;
    case Language.HTML:
      rules = [...rules, ...HTML_RULES];
      break;
    case Language.CSS:
      rules = [...rules, ...CSS_RULES];
      break;
  }

  // Execute Rules
  lines.forEach((line, index) => {
    if (!line.trim()) return;

    rules.forEach(rule => {
      const match = line.match(rule.regex);
      if (match) {
        issues.push({
          line: index + 1,
          type: rule.type,
          message: rule.message,
          fixSuggestion: rule.fixSuggestion,
          category: rule.category,
          suggestedCode: rule.suggestedCode ? rule.suggestedCode(match, line) : undefined
        });
      }
    });
  });

  return generateReportFromIssues(issues, code, fileName, language, 'Offline analysis complete.');
};

// --- AI ANALYSIS ENGINE ---

const analyzeCodeAI = async (code: string, language: Language, fileName: string): Promise<ReviewReport> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Cannot perform AI analysis.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Act as a Principal Software Engineer and Security Expert.
    Conduct a comprehensive code review of the following ${language} file named "${fileName}".

    Your analysis should be strictly technical, actionable, and precise. Avoid generic advice.

    Focus on the following categories:
    1. **Critical Bugs**: Logic errors, potential crashes, infinite loops, off-by-one errors, null pointer exceptions, and race conditions.
    2. **Security Vulnerabilities**: Check for OWASP Top 10 issues (e.g., SQL Injection, XSS, CSRF), hardcoded secrets, unsafe input handling, weak cryptography, and insecure dependencies.
    3. **Performance Bottlenecks**: Identify inefficient algorithms (O(n^2) or worse), memory leaks, unnecessary resource consumption, and N+1 query problems.
    4. **Code Style & Best Practices**: Evaluate naming conventions, code structure, SOLID principles, DRY (Don't Repeat Yourself), and modularity.

    For each issue identified:
    - ACCURACY: Ensure the line number is exactly where the issue occurs.
    - FIX: Provide a "suggestedCode" snippet that fixes the issue. It must be valid ${language} code that can directly replace the problematic line(s).
    - CATEGORY: Classify strictly into 'Syntax', 'Style', 'Security', 'Performance', or 'Best Practice'.

    Compute a "score" (0-100) based on the severity and count of issues (100 = perfect).
    Generate "stats" including an estimated cyclomatic complexity level.

    Code to Analyze:
    ${code}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER, description: "Code quality score from 0 to 100" },
          summary: { type: Type.STRING, description: "Executive summary of the code quality" },
          badges: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING }, 
            description: "Short badges like 'Secure', 'Spaghetti Code', 'Clean Code'"
          },
          stats: {
            type: Type.OBJECT,
            properties: {
              cyclomaticComplexity: { type: Type.STRING, description: "Low, Medium, or High" },
              maintainabilityIndex: { type: Type.NUMBER, description: "0 to 100" },
              securityScore: { type: Type.NUMBER, description: "0 to 100" }
            }
          },
          issues: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                line: { type: Type.INTEGER },
                type: { type: Type.STRING, description: "Error, Warning, or Suggestion" },
                message: { type: Type.STRING },
                fixSuggestion: { type: Type.STRING },
                suggestedCode: { type: Type.STRING, description: "The actual code snippet to replace the faulty line(s)" },
                category: { type: Type.STRING, description: "Syntax, Style, Security, Performance, or Best Practice" }
              },
              required: ["line", "type", "message", "fixSuggestion", "category"]
            }
          }
        },
        required: ["score", "summary", "badges", "stats", "issues"]
      }
    }
  });

  const rawText = response.text;
  if (!rawText) throw new Error("AI returned empty response");
  
  const aiResult = JSON.parse(rawText);

  // Normalize AI result to ensure it matches our internal structure strictly
  return {
    id: crypto.randomUUID(),
    fileName,
    timestamp: Date.now(),
    language,
    originalCode: code,
    score: aiResult.score,
    summary: aiResult.summary,
    badges: aiResult.badges,
    stats: aiResult.stats,
    issues: aiResult.issues.map((i: any) => ({
      ...i,
      // Ensure enum match if AI drifts
      type: ['Error', 'Warning', 'Suggestion'].includes(i.type) ? i.type : IssueType.WARNING, 
      category: ['Syntax', 'Style', 'Security', 'Performance', 'Best Practice'].includes(i.category) ? i.category : 'Best Practice'
    }))
  };
};


// --- SHARED HELPERS ---

const createEmptyReport = (fileName: string, language: Language, code: string): ReviewReport => ({
  id: crypto.randomUUID(),
  fileName,
  timestamp: Date.now(),
  language,
  originalCode: code,
  score: 0,
  summary: "The file appears to be empty.",
  issues: [],
  stats: { cyclomaticComplexity: "Low", maintainabilityIndex: 0, securityScore: 100 },
  badges: ["Empty"]
});

const generateReportFromIssues = (issues: Issue[], code: string, fileName: string, language: Language, baseSummary: string): ReviewReport => {
  let score = 100;
  issues.forEach(i => {
    switch (i.type) {
      case IssueType.ERROR: score -= 10; break;
      case IssueType.WARNING: score -= 5; break;
      case IssueType.SUGGESTION: score -= 1; break;
    }
  });
  score = Math.max(0, Math.min(100, score));

  // Heuristics for Stats
  const complexityKeywords = /(if|else|for|while|switch|case|catch|try|&&|\|\||\?)/g;
  const complexityCount = (code.match(complexityKeywords) || []).length;
  let cyclomaticComplexity = "Low";
  if (complexityCount > 20) cyclomaticComplexity = "Medium";
  if (complexityCount > 50) cyclomaticComplexity = "High";

  const linesCount = code.split('\n').length;
  const maintainabilityIndex = Math.max(0, 100 - (issues.length * 2) - (linesCount / 20));
  const securityIssues = issues.filter(i => i.category === 'Security').length;
  const securityScore = Math.max(0, 100 - (securityIssues * 20));

  // Badges
  const badges: string[] = [];
  if (score >= 90) badges.push('Clean Code');
  if (securityScore < 80) badges.push('Security Risk');
  if (cyclomaticComplexity === 'High') badges.push('Spaghetti Code');
  if (issues.length === 0) badges.push('Perfection');
  if (securityScore === 100) badges.push('Secure');
  if (linesCount > 300) badges.push('Large File');

  // Summary
  let summary = baseSummary + " ";
  if (score >= 80) summary += "The code is in good shape. ";
  else if (score >= 50) summary += "Requires some cleanup. ";
  else summary += "Critical issues detected. ";
  summary += `Found ${issues.length} issues.`;

  return {
    id: crypto.randomUUID(),
    fileName,
    timestamp: Date.now(),
    language,
    originalCode: code,
    score: Math.round(score),
    summary,
    issues,
    stats: {
      cyclomaticComplexity,
      maintainabilityIndex: Math.round(maintainabilityIndex),
      securityScore: Math.round(securityScore)
    },
    badges: badges.slice(0, 4)
  };
};

// --- MAIN EXPORT ---

export const analyzeCode = async (code: string, language: Language, fileName: string, mode: 'offline' | 'online'): Promise<ReviewReport> => {
  if (mode === 'online') {
    try {
      return await analyzeCodeAI(code, language, fileName);
    } catch (error) {
      console.error("AI Analysis failed, falling back to offline:", error);
      // Fallback to offline if AI fails (e.g. network error or quota)
      const report = await analyzeCodeOffline(code, language, fileName);
      report.summary = `[AI Failed - Offline Fallback] ${report.summary}`;
      return report;
    }
  } else {
    return await analyzeCodeOffline(code, language, fileName);
  }
};