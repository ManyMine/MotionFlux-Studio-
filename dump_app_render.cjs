const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf-8');
const start = content.indexOf('  return (\n    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">');
const end = content.indexOf('  );\n}\n');
console.log(content.substring(start, start + 3000));
