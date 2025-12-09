
const workerCode = `
self.onmessage = function(e) {
  const { type, data, id } = e.data;
  try {
    let result;
    switch(type) {
      case 'PARSE':
        result = JSON.parse(data);
        break;
      case 'JSON_TO_CSV':
        result = jsonToCsv(data);
        break;
      case 'CSV_TO_JSON':
        result = csvToJson(data);
        break;
    }
    self.postMessage({ type: 'SUCCESS', id, result });
  } catch (error) {
    self.postMessage({ type: 'ERROR', id, error: error.message });
  }
};

function jsonToCsv(items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  
  // Collect all unique keys from the first 1000 items (sampling for performance)
  // or all if reasonable size. Let's sample to be safe, but usually CSV needs consistent headers.
  // We will scan all items because missing columns in CSV is bad.
  const keys = new Set();
  items.forEach(item => {
    if (typeof item === 'object' && item !== null) {
      Object.keys(item).forEach(k => keys.add(k));
    }
  });
  
  const headers = Array.from(keys);
  const csvRows = [headers.join(',')];

  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    
    const values = headers.map(header => {
      const val = item[header];
      // Escape quotes and wrap in quotes
      const stringVal = val === null || val === undefined ? '' : String(val);
      const escaped = stringVal.replace(/"/g, '""'); 
      return \`"\${escaped}"\`;
    });
    csvRows.push(values.join(','));
  }
  return csvRows.join('\\n');
}

function csvToJson(csv) {
  const lines = csv.trim().split(/\\r?\\n/);
  if (lines.length < 2) return [];
  
  // Parse headers
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  const result = [];
  
  // Simple regex to split by comma but ignore commas inside quotes
  const splitRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i].trim();
    if (!currentLine) continue;

    const obj = {};
    const values = currentLine.split(splitRegex);
    
    headers.forEach((header, index) => {
      if (values[index] !== undefined) {
        let val = values[index].trim();
        
        // Remove surrounding quotes and unescape double quotes
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1).replace(/""/g, '"');
        }
        
        // Auto-convert types
        if (val === '') {
           obj[header] = null;
        } else if (!isNaN(Number(val)) && val.length > 0) {
           obj[header] = Number(val);
        } else if (val.toLowerCase() === 'true') {
           obj[header] = true;
        } else if (val.toLowerCase() === 'false') {
           obj[header] = false;
        } else {
           obj[header] = val;
        }
      }
    });
    result.push(obj);
  }
  return result;
}
`;

export const createWorker = () => {
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
};
