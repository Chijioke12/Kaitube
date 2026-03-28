import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');
const indexPath = path.join(distDir, 'index.html');

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf-8');
  let counter = 0;
  
  html = html.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs, content) => {
    if (content.trim().length > 0) {
      counter++;
      const fileName = `inline-script-${counter}.js`;
      const filePath = path.join(distDir, fileName);
      fs.writeFileSync(filePath, content, 'utf-8');
      
      // Remove the inline content and add src attribute
      // Ensure we don't duplicate src if it somehow already exists (though it shouldn't for inline scripts)
      return `<script${attrs} src="./${fileName}"></script>`;
    }
    return match;
  });
  
  // Also fix absolute paths to relative paths for KaiOS app packaging
  html = html.replace(/(src|href|data-src)="\/assets\//g, '$1="./assets/');
  
  fs.writeFileSync(indexPath, html, 'utf-8');
  console.log(`Extracted ${counter} inline scripts to satisfy KaiOS CSP.`);
} else {
  console.error('dist/index.html not found!');
}
