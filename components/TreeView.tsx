
import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Copy } from 'lucide-react';

interface JsonTreeProps {
  data: any;
  name?: string;
  isLast?: boolean;
  depth?: number;
}

const getDataType = (data: any): string => {
  if (data === null) return 'null';
  if (Array.isArray(data)) return 'array';
  return typeof data;
};

const ITEMS_PER_PAGE = 50;

export const JsonTree: React.FC<JsonTreeProps> = ({ data, name, isLast = true, depth = 0 }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(depth < 1); // Only expand root by default for perf
  const [isHovered, setIsHovered] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(ITEMS_PER_PAGE);
  
  const dataType = getDataType(data);
  const isObject = dataType === 'object' || dataType === 'array';
  const isEmpty = isObject && Object.keys(data).length === 0;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const showMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDisplayLimit(prev => prev + ITEMS_PER_PAGE);
  };

  const showAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDisplayLimit(Object.keys(data).length);
  };

  const renderLabel = () => {
    if (!name) return null;
    return <span className="text-purple-600 dark:text-purple-400 font-medium mr-1">"{name}"</span>;
  };

  const renderValue = () => {
    switch (dataType) {
      case 'string':
        return <span className="text-green-600 dark:text-green-400 break-all">"{data}"</span>;
      case 'number':
        return <span className="text-blue-600 dark:text-blue-400">{data}</span>;
      case 'boolean':
        return <span className="text-orange-600 dark:text-orange-400">{data.toString()}</span>;
      case 'null':
        return <span className="text-gray-500 dark:text-gray-400">null</span>;
      default:
        return null;
    }
  };

  if (!isObject) {
    return (
      <div 
        className="font-mono text-sm ml-4 hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-1 flex items-center group relative min-h-[24px]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {renderLabel()}
        {name && <span className="text-gray-500 mr-2">:</span>}
        {renderValue()}
        {!isLast && <span className="text-gray-500">,</span>}
        
        {isHovered && (
          <button onClick={handleCopy} className="ml-2 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-all opacity-70 hover:opacity-100">
             <Copy size={10} className="text-gray-500" />
          </button>
        )}
      </div>
    );
  }

  const keys = Object.keys(data);
  const totalItems = keys.length;
  const visibleKeys = keys.slice(0, displayLimit);
  const remaining = totalItems - displayLimit;

  const openBracket = dataType === 'array' ? '[' : '{';
  const closeBracket = dataType === 'array' ? ']' : '}';

  return (
    <div className="font-mono text-sm ml-4">
      <div 
        className="flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-1 group min-h-[24px]"
        onClick={toggleExpand}
      >
        <span className="mr-1 text-gray-500 dark:text-gray-400">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        {renderLabel()}
        {name && <span className="text-gray-500 mr-2">:</span>}
        <span className="text-gray-600 dark:text-gray-300 font-bold">{openBracket}</span>
        
        {!isExpanded && (
          <span className="text-gray-400 mx-2 text-xs italic">
             {dataType === 'array' ? `${data.length} items` : `${keys.length} keys`}
          </span>
        )}
        
        {!isExpanded && (
          <span className="text-gray-600 dark:text-gray-300 font-bold">
            {closeBracket}{!isLast && ','}
          </span>
        )}

        <button 
          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(JSON.stringify(data, null, 2)); }} 
          className="ml-2 opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-opacity"
          title="Copy Object"
        >
          <Copy size={12} />
        </button>
      </div>

      {isExpanded && !isEmpty && (
        <div className="border-l border-gray-300 dark:border-gray-700 ml-2 pl-2">
          {visibleKeys.map((key, index) => (
            <JsonTree
              key={key}
              name={dataType === 'array' ? undefined : key}
              data={data[key]}
              isLast={index === visibleKeys.length - 1 && remaining === 0}
              depth={depth + 1}
            />
          ))}
          
          {remaining > 0 && (
            <div className="ml-4 mt-1 flex items-center gap-2">
              <button 
                onClick={showMore}
                className="px-2 py-0.5 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 rounded text-xs text-slate-600 dark:text-slate-300 transition-colors"
              >
                Show {Math.min(remaining, ITEMS_PER_PAGE)} more...
              </button>
              <button 
                onClick={showAll}
                className="px-2 py-0.5 text-xs text-indigo-500 hover:text-indigo-400 underline decoration-dotted"
              >
                Show all ({remaining} remaining)
              </button>
            </div>
          )}
        </div>
      )}

      {isExpanded && (
        <div className="ml-6">
          <span className="text-gray-600 dark:text-gray-300 font-bold">
            {closeBracket}{!isLast && ','}
          </span>
        </div>
      )}
    </div>
  );
};
