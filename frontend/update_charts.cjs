const fs = require('fs');
const file = 'd:/BAMBANG_DJAJA/WebDemoTrafo/BambangDjaja/frontend/src/pages/Dashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update imports
content = content.replace(/import\s*\{\s*LineChart,\s*Line,/g, 'import {\n  AreaChart, Area, LineChart, Line,');

// 2. Change LineChart to AreaChart
content = content.replace(/<LineChart/g, '<AreaChart');
content = content.replace(/<\/LineChart>/g, '</AreaChart>');

// 3. Change CartesianGrid vertical={false} to vertical={true}
content = content.replace(/vertical=\{false\}/g, 'vertical={true}');

// 4. Replace <Line ... /> with <Area ... fillOpacity={0.15} fill="stroke-color" />
content = content.replace(/<Line\s+([^>]*?)stroke=["']([^"']+)["']([^>]*?)\/?>/g, '<Area fillOpacity={0.15} fill="$2" $1stroke="$2"$3 />');

fs.writeFileSync(file, content);
console.log('Successfully updated charts in Dashboard.jsx');
