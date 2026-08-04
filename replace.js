const fs = require('fs');
const path = require('path');
const dir = 'frontend/src/components/visualizations';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));
let count = 0;
files.forEach(f => {
  const p = path.join(dir, f);
  let content = fs.readFileSync(p, 'utf8');
  let newContent = content.replace(/className="text-sm font-semibold text-\[#172b4d\] dark:text-white font-heading truncate flex-1"/g, 'className="text-xs font-semibold text-gray-500 dark:text-gray-400 font-sans text-center truncate flex-1 tracking-wide"');
  newContent = newContent.replace(/className="font-semibold text-\[#172b4d\] dark:text-white text-sm font-heading tracking-tight flex-1"/g, 'className="text-xs font-semibold text-gray-500 dark:text-gray-400 font-sans text-center truncate flex-1 tracking-wide"');
  if (content !== newContent) {
    fs.writeFileSync(p, newContent);
    count++;
  }
});
console.log('Updated ' + count + ' files.');
