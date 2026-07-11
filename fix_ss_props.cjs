const fs = require('fs');
let ssContent = fs.readFileSync('src/components/StartScreen.tsx', 'utf-8');

ssContent = ssContent.replace(
  "onRemixProject: (project: Omit<Project, 'id' | 'updatedAt'> & { name: string }) => void;", 
  "onRemixProject: (project: Omit<Project, 'id' | 'updatedAt'> & { name: string }) => void;\n  onSwitchTheme?: () => void;"
);

ssContent = ssContent.replace(
  "onRemixProject,\n  onSwitchTheme\n}: StartScreenProps) {", 
  "onRemixProject\n}: StartScreenProps) {"
);

ssContent = ssContent.replace(
  "onRemixProject\n}: StartScreenProps) {", 
  "onRemixProject,\n  onSwitchTheme\n}: StartScreenProps) {"
);

fs.writeFileSync('src/components/StartScreen.tsx', ssContent);
console.log('Fixed SS props correctly');
