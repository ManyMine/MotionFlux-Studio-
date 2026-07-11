const fs = require('fs');
let content = fs.readFileSync('src/components/StartScreen.tsx', 'utf-8');

// Change text for Tutoriais
content = content.replace(/<span className="text-\[10px\] font-medium">Tutoriais<\/span>/, '<span className="text-[10px] font-medium">Tutoriais (breve)</span>');

// Remove Modelos button from bottom nav
const btnStart = content.indexOf('<button \n          onClick={() => setActiveTab(\'templates\')}');
if (btnStart !== -1) {
  const btnEnd = content.indexOf('</button>', btnStart) + 9;
  content = content.substring(0, btnStart) + content.substring(btnEnd);
}

fs.writeFileSync('src/components/StartScreen.tsx', content);
console.log('Fixed nav');
