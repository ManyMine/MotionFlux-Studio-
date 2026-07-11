const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf-8');
const start = content.indexOf('return (');
const end = content.indexOf('  );\n}\n');
console.log(content.substring(start, start + 3000));
