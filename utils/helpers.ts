import { Language, HistoryItem, ReviewReport, IssueType } from '../types';

declare global {
  interface Window {
    jspdf: any;
  }
}

export const detectLanguage = (fileName: string, content: string = ''): Language => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  // Priority 1: Strong extension match
  if (fileName.includes('.') && ext) {
    switch (ext) {
      case 'js': case 'jsx': case 'mjs': return Language.JAVASCRIPT;
      case 'ts': case 'tsx': return Language.TYPESCRIPT;
      case 'py': return Language.PYTHON;
      case 'java': return Language.JAVA;
      case 'c': return Language.C;
      case 'cpp': case 'cc': case 'cxx': return Language.CPP;
      case 'html': case 'htm': return Language.HTML;
      case 'css': case 'scss': return Language.CSS;
    }
  }

  // Priority 2: Content-based heuristics
  if (content) {
    const patterns: { lang: Language; regex: RegExp }[] = [
      { lang: Language.HTML, regex: /<!DOCTYPE html>|<html|<\/body>|<div/i },
      { lang: Language.CSS, regex: /body\s*\{|\.[a-z0-9_-]+\s*\{|#[\w-]+\s*\{|margin:|padding:/i },
      { lang: Language.JAVA, regex: /public\s+class\s+\w+|System\.out\.println|public\s+static\s+void\s+main|import\s+java\./ },
      { lang: Language.CPP, regex: /#include\s+<iostream>|std::|using\s+namespace\s+std|template\s*</ },
      { lang: Language.C, regex: /#include\s+<stdio\.h>|printf\s*\(|int\s+main\s*\(/ },
      { lang: Language.PYTHON, regex: /def\s+\w+\s*\(|import\s+\w+|print\s*\(|if\s+__name__\s*==\s*['"]__main__['"]:/ },
      { lang: Language.TYPESCRIPT, regex: /interface\s+\w+|type\s+\w+\s*=|:\s*(string|number|boolean|void|any)\[?\]?|const\s+\w+\s*:\s*\w+\s*=/ },
      { lang: Language.JAVASCRIPT, regex: /const\s+\w+|let\s+\w+|function\s+\w+|console\.log|=>|export\s+default/ },
    ];

    for (const { lang, regex } of patterns) {
      if (regex.test(content)) {
        return lang;
      }
    }
  }

  return Language.UNKNOWN;
};

export const getHistory = (): HistoryItem[] => {
  try {
    const data = localStorage.getItem('code_reviewer_history');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load history", e);
    return [];
  }
};

export const saveToHistory = (report: ReviewReport): HistoryItem[] => {
  try {
    const history = getHistory();
    const newItem: HistoryItem = {
      id: report.id,
      fileName: report.fileName,
      timestamp: report.timestamp,
      score: report.score,
      language: report.language
    };
    
    // Remove duplicates based on ID and keep last 5
    const updated = [newItem, ...history.filter(h => h.id !== newItem.id)].slice(0, 5);
    localStorage.setItem('code_reviewer_history', JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error("Failed to save history", e);
    return [];
  }
};

export const downloadReport = (report: ReviewReport, format: 'json' | 'txt' | 'pdf') => {
  const dateStr = new Date(report.timestamp).toISOString().split('T')[0];
  const filename = `Review-${report.fileName}-${dateStr}.${format}`;

  // --- PDF GENERATION LOGIC ---
  if (format === 'pdf') {
    if (!window.jspdf) {
      alert('PDF generator library is not loaded yet. Please try again in a moment.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // -- Configuration --
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    const primaryColor = [79, 70, 229]; // Indigo 600
    const secondaryColor = [107, 114, 128]; // Gray 500
    const lightBg = [249, 250, 251]; // Gray 50
    
    let yPos = 0; // Current Y position cursor

    // -- Helpers --
    const addPage = () => {
      doc.addPage();
      yPos = 20; // Reset Y for new page
    };

    const checkPageBreak = (heightToAdd: number) => {
      if (yPos + heightToAdd > pageHeight - margin) {
        addPage();
      }
    };

    // ================= HEADER =================
    // Colored Top Banner
    doc.setFillColor(primaryColor[1], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 40, 'F');

    // Title (White)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.text("AI powered code reviewer", margin, 20);

    // Subtitle (White, slightly transparent)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(224, 231, 255); // Indigo 100
    doc.text("Automated Quality & Security Analysis", margin, 30);

    // Metadata (Right aligned in banner)
    doc.setFontSize(10);
    doc.text(`Date: ${new Date(report.timestamp).toLocaleDateString()}`, pageWidth - margin, 20, { align: 'right' });
    doc.text(`File: ${report.fileName}`, pageWidth - margin, 30, { align: 'right' });

    yPos = 55;

    // ================= SCORE DASHBOARD =================
    // Draw Score Circle
    const scoreX = margin + 20;
    const scoreY = yPos + 15;
    const radius = 18;

    // Determine score color
    let scoreR = 34, scoreG = 197, scoreB = 94; // Green
    if (report.score < 80) { scoreR = 234; scoreG = 179; scoreB = 8; } // Yellow
    if (report.score < 60) { scoreR = 239; scoreG = 68; scoreB = 68; } // Red

    // Circle Fill
    doc.setFillColor(scoreR, scoreG, scoreB);
    doc.circle(scoreX, scoreY, radius, 'F');

    // Score Text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(report.score.toString(), scoreX, scoreY + 2, { align: 'center' }); // Centered text
    
    doc.setFontSize(10);
    doc.text("SCORE", scoreX, scoreY + 10, { align: 'center' });

    // Grade Label next to circle
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text("Quality Assessment", scoreX + 35, yPos + 10);
    
    // Summary Text below heading
    doc.setFontSize(10);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setFont("helvetica", "normal");
    const summaryLines = doc.splitTextToSize(report.summary, contentWidth - 70);
    doc.text(summaryLines, scoreX + 35, yPos + 20);

    yPos += 50; // Move down after dashboard

    // ================= STATS GRID =================
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.rect(margin, yPos, contentWidth, 25, 'F'); // Stats container background
    
    const colWidth = contentWidth / 3;
    const statY = yPos + 10;
    const valY = yPos + 18;

    // 1. Complexity
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("COMPLEXITY", margin + (colWidth/2), statY, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(report.stats.cyclomaticComplexity, margin + (colWidth/2), valY, { align: 'center' });

    // 2. Maintainability
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("MAINTAINABILITY", margin + (colWidth * 1.5), statY, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`${report.stats.maintainabilityIndex}/100`, margin + (colWidth * 1.5), valY, { align: 'center' });

    // 3. Security
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("SECURITY", margin + (colWidth * 2.5), statY, { align: 'center' });

    doc.setFontSize(12);
    // Color code the security score text
    if (report.stats.securityScore < 70) doc.setTextColor(239, 68, 68);
    else doc.setTextColor(34, 197, 94);
    
    doc.text(`${report.stats.securityScore}/100`, margin + (colWidth * 2.5), valY, { align: 'center' });

    yPos += 40; // Move down

    // ================= DETAILED ISSUES =================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Detailed Findings", margin, yPos);
    
    // Draw underline
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos + 2, margin + 45, yPos + 2);
    
    yPos += 15;

    if (report.issues.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(11);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text("No issues found. Great job!", margin, yPos);
    }

    // Loop Issues
    report.issues.forEach((issue) => {
      const cardPadding = 5;
      const cardWidth = contentWidth;
      
      // Calculate text wrapping height
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10); // Header font
      const headerText = `[${issue.type.toUpperCase()}] Line ${issue.line}: ${issue.category}`;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10); // Body font
      const messageLines = doc.splitTextToSize(issue.message, cardWidth - 15); // -15 for padding/border
      const fixLines = doc.splitTextToSize(`Fix: ${issue.fixSuggestion}`, cardWidth - 15);
      
      // Calculate total card height
      // Header (6) + Message (lines * 5) + Spacing (4) + Fix (lines * 5) + Padding (10)
      const cardHeight = 6 + (messageLines.length * 5) + 4 + (fixLines.length * 5) + 10;

      // Page Break Check
      checkPageBreak(cardHeight + 5);

      // Draw Card Background
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(230, 230, 230);
      // Draw a light border box
      doc.rect(margin, yPos, cardWidth, cardHeight, 'FD'); // FD = Fill & Draw

      // Draw Colored Left Border (Severity Indicator)
      let borderColor = [79, 70, 229]; // Blue/Indigo (Suggestion)
      if (issue.type === IssueType.ERROR) borderColor = [220, 38, 38]; // Red
      if (issue.type === IssueType.WARNING) borderColor = [217, 119, 6]; // Amber
      
      doc.setFillColor(borderColor[0], borderColor[1], borderColor[2]);
      doc.rect(margin, yPos, 2, cardHeight, 'F'); // 2px wide strip

      // --- Content Inside Card ---
      let localY = yPos + 8;

      // Header (Type - Line - Category)
      doc.setTextColor(borderColor[0], borderColor[1], borderColor[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(headerText, margin + 6, localY);
      localY += 6;

      // Message Body
      doc.setTextColor(30, 30, 30); // Almost black
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(messageLines, margin + 6, localY);
      localY += (messageLines.length * 5) + 3;

      // Fix Suggestion (Greyer)
      doc.setTextColor(75, 85, 99); // Gray 600
      doc.setFont("helvetica", "italic");
      doc.text(fixLines, margin + 6, localY);

      // Update main Y cursor
      yPos += cardHeight + 6; // +6 gap between cards
    });

    // Footer (Page Numbers)
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    doc.save(filename);
    return;
  }

  // --- Fallback for TXT/JSON (Unchanged) ---
  let content = '';
  let mimeType = '';

  if (format === 'json') {
    content = JSON.stringify(report, null, 2);
    mimeType = 'application/json';
  } else {
    content = `CODE REVIEWER REPORT\nFile: ${report.fileName}\nDate: ${new Date(report.timestamp).toLocaleString()}\nScore: ${report.score}/100\n\n${report.summary}\n\nISSUES:\n${report.issues.map(i => `[${i.type}] Line ${i.line}: ${i.message} -> ${i.fixSuggestion}`).join('\n')}`;
    mimeType = 'text/plain';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};