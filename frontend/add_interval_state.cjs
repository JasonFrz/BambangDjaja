const fs = require('fs');
const file = 'd:/BAMBANG_DJAJA/WebDemoTrafo/BambangDjaja/frontend/src/pages/Dashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add state
const stateTarget = `  const [exportEnd, setExportEnd] = useState('');
  const [isExporting, setIsExporting] = useState(false);`;
const stateReplace = `  const [exportEnd, setExportEnd] = useState('');
  const [exportInterval, setExportInterval] = useState('');
  const [isExporting, setIsExporting] = useState(false);`;
content = content.replace(stateTarget, stateReplace);

// 2. Add to API call
const apiTarget = `      const startISO = new Date(exportStart).toISOString();
      const endISO = new Date(exportEnd).toISOString();
      const url = \`\${apiUrl}/api/trends?start=\${startISO}&end=\${endISO}\`;

      const response = await axios.get(url);`;
const apiReplace = `      const startISO = new Date(exportStart).toISOString();
      const endISO = new Date(exportEnd).toISOString();
      let url = \`\${apiUrl}/api/trends?start=\${startISO}&end=\${endISO}\`;
      if (exportInterval) {
        url += \`&interval=\${exportInterval}\`;
      }

      const response = await axios.get(url);`;
content = content.replace(apiTarget, apiReplace);

fs.writeFileSync(file, content);
console.log('Successfully updated states and API call in Dashboard.jsx');
