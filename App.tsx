
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Sun, Moon, Code, Network, FileJson, 
  Wand2, Braces, Minimize2, Copy, Trash2, 
  ArrowLeftRight, Play, Database, Check,
  Upload, Download, FileText
} from 'lucide-react';
import { JsonTree } from './components/TreeView';
import { repairJsonWithAi, generateMongooseSchemaWithAi } from './services/geminiService';
import { createWorker } from './utils/jsonWorker';

// --- Helper for formatting Date ---
const formatDate = () => new Date().toLocaleTimeString();

// --- Types ---
type ViewMode = 'tree' | 'raw' | 'mongoose';
type Theme = 'light' | 'dark';

export default function App() {
  const [input, setInput] = useState<string>('{\n  "projectName": "JSON Architect",\n  "version": 1.0,\n  "features": [\n    "Tree View",\n    "Mongoose Schema"\n  ],\n  "active": true\n}');
  const [json, setJson] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [theme, setTheme] = useState<Theme>('dark');
  const [isThinking, setIsThinking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  
  // Large file handling
  const [isLargeFile, setIsLargeFile] = useState(false);
  
  // Mongoose Specific State
  const [mongooseSchema, setMongooseSchema] = useState<string>('');
  const [mongoosePrompt, setMongoosePrompt] = useState<string>('');

  // Worker Ref
  const workerRef = useRef<Worker | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Theme Handling ---
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // --- Worker Initialization ---
  useEffect(() => {
    workerRef.current = createWorker();
    
    workerRef.current.onmessage = (e) => {
      const { type, result, error } = e.data;
      setIsProcessing(false);
      
      if (type === 'ERROR') {
        setError(error);
        setStatusMsg("Processing Error");
      } else if (type === 'SUCCESS') {
        // We identify the operation by checking what we expected or ID
        // Simplified for this app: if result is object/array -> PARSE/CSV_TO_JSON
        // if result is string -> JSON_TO_CSV
        
        if (typeof result === 'string') {
          // CSV Export result
          downloadFile(result, 'export.csv', 'text/csv');
          setStatusMsg("CSV Exported");
        } else {
          // JSON Parse Result
          setJson(result);
          setError(null);
          setStatusMsg("Data Loaded Successfully");
        }
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const runWorkerTask = (type: string, data: any) => {
    setIsProcessing(true);
    setStatusMsg("Processing in background...");
    workerRef.current?.postMessage({ type, data, id: Date.now() });
  };

  // --- JSON Parsing Engine ---
  const parseJson = useCallback((raw: string) => {
    // If it's a large file placeholder, don't parse the placeholder text
    if (raw.startsWith('[LARGE FILE LOADED]')) return;

    try {
      if (!raw.trim()) {
        setJson(null);
        setError(null);
        return;
      }
      // Attempt strict parse first for small inputs on main thread
      // If input is huge (e.g. paste), this might freeze.
      // For typed input, we assume reasonable size.
      const parsed = JSON.parse(raw);
      setJson(parsed);
      setError(null);
      setIsLargeFile(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!isLargeFile) {
      parseJson(input);
    }
  }, [input, parseJson, isLargeFile]);

  // --- Actions ---

  const handleFormat = () => {
    if (isLargeFile) {
      setStatusMsg("Cannot format large file in editor");
      return;
    }
    try {
      const parsed = JSON.parse(input);
      setInput(JSON.stringify(parsed, null, 2));
      setStatusMsg(`Formatted at ${formatDate()}`);
    } catch (e) {
      setStatusMsg("Invalid JSON: Cannot format");
    }
  };

  const handleUnescape = () => {
    if (isLargeFile) return;
    try {
      const unescaped = input.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      if (input.startsWith('"') && input.endsWith('"')) {
          try {
             const inner = JSON.parse(input);
             setInput(typeof inner === 'string' ? inner : unescaped);
          } catch {
              setInput(unescaped);
          }
      } else {
          setInput(unescaped);
      }
      setStatusMsg(`Unescaped at ${formatDate()}`);
    } catch (e) {
      setStatusMsg("Could not unescape");
    }
  };

  const handleJsToJSON = () => {
    if (isLargeFile) return;
    try {
      // eslint-disable-next-line no-new-func
      const func = new Function("return " + input);
      const res = func();
      const stringified = JSON.stringify(res, null, 2);
      setInput(stringified);
      setStatusMsg("Converted JS Object to JSON");
    } catch (e) {
      setError("Could not parse JS Object. Try using AI Fix.");
    }
  };

  const handleAiFix = async () => {
    if (isLargeFile) {
      setStatusMsg("AI Fix disabled for large files");
      return;
    }
    setIsThinking(true);
    setStatusMsg("AI is repairing your JSON...");
    try {
      const fixed = await repairJsonWithAi(input);
      setInput(fixed);
      setStatusMsg("JSON Repaired by AI");
    } catch (e) {
      setStatusMsg("AI Repair Failed");
    } finally {
      setIsThinking(false);
    }
  };

  const handleClear = () => {
    setInput('');
    setJson(null);
    setError(null);
    setIsLargeFile(false);
  };

  const handleMinify = () => {
    if (json) {
       // If large file, we might not want to dump it all into Input
       // But user asked for it.
       const str = JSON.stringify(json);
       if (str.length > 5000000) {
         if (!window.confirm("This is a very large file. Minifying it into the editor might freeze the browser. Continue?")) return;
       }
       setInput(str);
       setIsLargeFile(false);
       setStatusMsg("Minified");
    }
  };

  // --- File I/O ---

  const handleLoadFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMsg(`Loading ${file.name}...`);
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result as string;
      
      if (file.name.endsWith('.csv')) {
        // Use Worker for CSV conversion
        runWorkerTask('CSV_TO_JSON', content);
        setInput(`[CSV IMPORTED: ${file.name}]\n(View data in Tree View)`);
        setIsLargeFile(true);
      } else {
        // It's likely JSON or Text
        // Check size. > 2MB?
        if (file.size > 2 * 1024 * 1024) {
          setIsLargeFile(true);
          setInput(`[LARGE FILE LOADED: ${file.name} - ${(file.size / 1024 / 1024).toFixed(2)} MB]\n(Content hidden for performance. View data in Tree View)`);
          // Use worker to parse
          runWorkerTask('PARSE', content);
        } else {
          setIsLargeFile(false);
          setInput(content);
          // Standard parse will happen via useEffect
        }
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = ''; 
  };

  const handleExportCsv = () => {
    if (!json || !Array.isArray(json)) {
      alert("Can only export JSON Arrays to CSV.");
      return;
    }
    runWorkerTask('JSON_TO_CSV', json);
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Mongoose Logic ---

  const generateBasicMongoose = () => {
    if (!json) return;
    
    // Simple deterministic generator
    const generateSchemaStr = (obj: any): string => {
        if (Array.isArray(obj)) {
            if (obj.length > 0) {
                return `[${generateSchemaStr(obj[0])}]`;
            }
            return '[]';
        }
        if (typeof obj === 'object' && obj !== null) {
            const lines = Object.entries(obj).map(([key, value]) => {
                return `  ${key}: ${generateSchemaStr(value)}`;
            });
            return `{\n${lines.join(',\n')}\n}`;
        }
        if (typeof obj === 'string') return '{ type: String }';
        if (typeof obj === 'number') return '{ type: Number }';
        if (typeof obj === 'boolean') return '{ type: Boolean }';
        return '{ type: mongoose.Schema.Types.Mixed }';
    };

    const schemaStr = `const schema = new mongoose.Schema(${generateSchemaStr(json)}, { timestamps: true });`;
    setMongooseSchema(schemaStr);
    setViewMode('mongoose');
  };

  const handleAiMongoose = async () => {
     if (!input && !json) return;
     setIsThinking(true);
     setStatusMsg("AI is designing your Schema...");
     try {
       // If large file, we use a sample of the JSON for the prompt
       let dataContext = input;
       if (isLargeFile && json) {
         // Take first item of array or subset of keys
         dataContext = JSON.stringify(Array.isArray(json) ? json.slice(0, 1) : json);
       }

       const schema = await generateMongooseSchemaWithAi(dataContext, mongoosePrompt || "Add reasonable validations (required, min/max) based on data values. Add timestamps.");
       setMongooseSchema(schema);
       setViewMode('mongoose');
       setStatusMsg("Schema generated by AI");
     } catch(e) {
        setStatusMsg("AI Schema Generation Failed");
     } finally {
        setIsThinking(false);
     }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gray-50 dark:bg-darkbg text-slate-800 dark:text-slate-100 font-sans">
      
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".json,.csv,.txt"
        className="hidden" 
      />

      {/* Header */}
      <header className="h-14 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between px-4 bg-white dark:bg-darkpanel z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-2 rounded-lg">
             <Braces className="text-white w-5 h-5" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">JSON Architect</h1>
        </div>

        <div className="flex items-center gap-4">
           {isProcessing && (
             <div className="flex items-center gap-2 text-xs text-blue-500 font-medium">
               <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
               Processing...
             </div>
           )}
           {statusMsg && !isProcessing && (
             <span className="text-xs text-indigo-600 dark:text-indigo-400 animate-pulse">{statusMsg}</span>
           )}
           <button 
             onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
             className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
           >
             {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
           </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left Column: Input Editor */}
        <div className="w-1/2 flex flex-col border-r border-gray-200 dark:border-slate-800">
          
          {/* Toolbar */}
          <div className="h-12 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 flex items-center px-4 gap-2 overflow-x-auto no-scrollbar">
             <ToolButton icon={<Upload size={14}/>} label="Load File" onClick={handleLoadFileClick} />
             <div className="w-px h-4 bg-gray-300 dark:bg-slate-700 mx-1"></div>
             <ToolButton icon={<Wand2 size={14}/>} label="Format" onClick={handleFormat} />
             <ToolButton icon={<Minimize2 size={14}/>} label="Minify" onClick={handleMinify} />
             <div className="w-px h-4 bg-gray-300 dark:bg-slate-700 mx-1"></div>
             <ToolButton icon={<ArrowLeftRight size={14}/>} label="Unescape" onClick={handleUnescape} />
             <ToolButton icon={<FileJson size={14}/>} label="JS → JSON" onClick={handleJsToJSON} />
             <div className="w-px h-4 bg-gray-300 dark:bg-slate-700 mx-1"></div>
             <ToolButton icon={<Trash2 size={14}/>} label="Clear" onClick={handleClear} danger />
             
             <div className="ml-auto flex items-center">
                <button 
                  onClick={handleAiFix}
                  disabled={isThinking || isLargeFile}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-full shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all"
                >
                  <Wand2 size={12} />
                  {isThinking ? 'Thinking...' : 'AI Repair'}
                </button>
             </div>
          </div>

          {/* Editor Area */}
          <div className="flex-1 relative group bg-white dark:bg-darkbg">
            <textarea
              value={input}
              onChange={(e) => {
                 if (isLargeFile) {
                    if (window.confirm("Editing this placeholder will reset the large file view. Continue?")) {
                       setIsLargeFile(false);
                       setInput(e.target.value);
                    }
                 } else {
                    setInput(e.target.value);
                 }
              }}
              readOnly={isLargeFile}
              className={`w-full h-full p-4 font-mono text-sm bg-transparent resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50 leading-relaxed custom-scrollbar text-slate-700 dark:text-slate-300 ${isLargeFile ? 'opacity-50 cursor-not-allowed' : ''}`}
              spellCheck="false"
              placeholder="Paste JSON or JS Object here..."
            />
            {error && (
              <div className="absolute bottom-4 left-4 right-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded border border-red-200 dark:border-red-800 text-xs font-mono shadow-sm flex items-start gap-2">
                <div className="mt-0.5 w-2 h-2 rounded-full bg-red-500 shrink-0"></div>
                {error}
              </div>
            )}
            
            {/* Drag Overlay hint could go here */}
          </div>
        </div>

        {/* Right Column: Output & Tools */}
        <div className="w-1/2 flex flex-col bg-white dark:bg-darkpanel">
          
          {/* Tabs */}
          <div className="h-12 border-b border-gray-200 dark:border-slate-800 flex items-center px-2">
            <TabButton active={viewMode === 'tree'} onClick={() => setViewMode('tree')} icon={<Network size={14}/>} label="Tree View" />
            <TabButton active={viewMode === 'raw'} onClick={() => setViewMode('raw')} icon={<Code size={14}/>} label="Raw JSON" />
            <TabButton active={viewMode === 'mongoose'} onClick={() => { generateBasicMongoose(); setViewMode('mongoose'); }} icon={<Database size={14}/>} label="Schema" />
            
            <div className="ml-auto flex items-center gap-3">
               {json && Array.isArray(json) && (
                 <button 
                   onClick={handleExportCsv}
                   className="flex items-center gap-1.5 px-3 py-1 bg-green-600/10 hover:bg-green-600/20 text-green-600 dark:text-green-400 rounded text-xs font-medium transition-colors"
                   title="Export as CSV"
                 >
                   <FileText size={12} />
                   Export CSV
                 </button>
               )}
               <span className="text-xs text-slate-400 mr-3 hidden sm:inline-block">
                 {json ? (Array.isArray(json) ? `${json.length} items` : 'Object') : 'Empty'}
               </span>
            </div>
          </div>

          {/* View Content */}
          <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-gray-50 dark:bg-darkpanel/50">
             
             {/* Tree View */}
             {viewMode === 'tree' && (
               <div className="min-h-full">
                 {json ? (
                   <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-4 shadow-sm">
                     <JsonTree data={json} name="root" isLast={true} />
                   </div>
                 ) : (
                   <EmptyState />
                 )}
               </div>
             )}

             {/* Raw JSON View */}
             {viewMode === 'raw' && (
                <div className="relative min-h-full">
                   {json ? (
                      <pre className="font-mono text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all bg-white dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-slate-800">
                        {isLargeFile ? "Raw view disabled for large files. Please check Tree View or Export." : JSON.stringify(json, null, 2)}
                      </pre>
                   ) : <EmptyState />}
                </div>
             )}

             {/* Mongoose Builder View */}
             {viewMode === 'mongoose' && (
               <div className="flex flex-col h-full gap-4">
                 
                 {/* AI Controls */}
                 <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-slate-800 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                       <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                         <Wand2 size={16} className="text-purple-500" />
                         AI Schema Refinement
                       </h3>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={mongoosePrompt}
                        onChange={(e) => setMongoosePrompt(e.target.value)}
                        placeholder="e.g. 'Make emails unique, age min 18, add timestamps'"
                        className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-purple-500 outline-none"
                      />
                      <button 
                        onClick={handleAiMongoose}
                        disabled={isThinking || !json}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                         {isThinking ? 'Generating...' : 'Generate'}
                         {!isThinking && <Play size={12} fill="currentColor" />}
                      </button>
                    </div>
                 </div>

                 {/* Schema Output */}
                 <div className="flex-1 relative group">
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button 
                        onClick={() => navigator.clipboard.writeText(mongooseSchema)}
                        className="p-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-slate-500 transition-colors"
                        title="Copy Code"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <textarea 
                      readOnly
                      value={mongooseSchema || "// Generate schema to see output"}
                      className="w-full h-full font-mono text-sm bg-slate-900 text-green-400 p-4 rounded-lg resize-none focus:outline-none leading-relaxed"
                    />
                 </div>
               </div>
             )}
          </div>
        </div>
      </main>
    </div>
  );
}

// --- Subcomponents ---

const ToolButton = ({ icon, label, onClick, danger }: { icon: React.ReactNode, label: string, onClick: () => void, danger?: boolean }) => (
  <button 
    onClick={onClick}
    className={`
      flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap
      ${danger 
        ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20' 
        : 'text-slate-600 hover:bg-white hover:shadow-sm dark:text-slate-300 dark:hover:bg-slate-800'
      }
    `}
  >
    {icon}
    {label}
  </button>
);

const TabButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button
    onClick={onClick}
    className={`
      flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all
      ${active 
        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10' 
        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800/50'
      }
    `}
  >
    {icon}
    {label}
  </button>
);

const EmptyState = () => (
  <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
    <FileJson size={48} className="mb-4 opacity-50" />
    <p className="text-sm">No valid JSON data to display</p>
  </div>
);
