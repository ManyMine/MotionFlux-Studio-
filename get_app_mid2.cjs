const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf-8');
const idx = content.indexOf('if (!currentProjectId)');
console.log(content.substring(idx, idx + 4000));
