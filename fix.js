const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      if (!fullPath.endsWith('App.jsx') && !fullPath.endsWith('Login.jsx') && !fullPath.endsWith('Profile.jsx')) {
        let changed = false;
        if (content.includes("getItem('company_name')")) {
          content = content.replace(/getItem\('company_name'\)/g, "getItem('db_name')");
          changed = true;
        }
        if (content.includes('getItem("company_name")')) {
          content = content.replace(/getItem\("company_name"\)/g, 'getItem("db_name")');
          changed = true;
        }
        if (changed) {
          fs.writeFileSync(fullPath, content);
          console.log('Fixed ' + fullPath);
        }
      }
    }
  }
}

replaceInDir('d:/BAMBANG_DJAJA/WebDemoTrafo/BambangDjaja/frontend/src');
