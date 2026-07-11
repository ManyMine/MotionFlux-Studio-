const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf-8');
const idx = content.indexOf('return (');
console.log(content.substring(idx, content.length));
