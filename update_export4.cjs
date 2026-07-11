const fs = require('fs');
let content = fs.readFileSync('src/utils/exportOffline.ts', 'utf8');

const target = `
      } else if (textClip.animationType === 'blur-reveal') {
        const animProgress = Math.min(1, textProgress / 0.4);
        ctx.filter = \`blur(\${(1 - animProgress) * 20}px)\`;
        textOpacity *= animProgress;
      }
`;

const replace = `
      } else if (textClip.animationType === 'blur-reveal') {
        const animProgress = Math.min(1, textProgress / 0.4);
        ctx.filter = \`blur(\${(1 - animProgress) * 20}px)\`;
        textOpacity *= animProgress;
      } else if (textClip.animationType === 'letter-stagger') {
        const animProgress = Math.min(1, textProgress / 0.45);
        const letterSpacing = (1 - animProgress) * 15;
        (ctx as any).letterSpacing = \`\${letterSpacing}px\`;
        textOpacity *= animProgress;
      }
`;

content = content.replace(target, replace);
fs.writeFileSync('src/utils/exportOffline.ts', content);
