const fs = require('fs');
let content = fs.readFileSync('src/utils/exportOffline.ts', 'utf8');

const targetDraw = `
      const exportScaleFactor = canvas.height / 720;
      ctx.save();
      ctx.globalAlpha = opacity;
`;

const replaceDraw = `
      const exportScaleFactor = canvas.height / 720;
      ctx.save();
      
      if (clipPathRect) {
          ctx.beginPath();
          ctx.rect(clipPathRect.x, clipPathRect.y, clipPathRect.w, clipPathRect.h);
          ctx.clip();
      }

      ctx.globalAlpha = opacity;
`;

content = content.replace(targetDraw, replaceDraw);
fs.writeFileSync('src/utils/exportOffline.ts', content);
