import fs from 'fs';

const popupPath = 'extension/popup.html';
let html = fs.readFileSync(popupPath, 'utf8');

if (!html.includes('assets/styles/ai-lab.css')) {
  html = html.replace(
    '<link rel="stylesheet" href="assets/styles/clips.css">',
    '<link rel="stylesheet" href="assets/styles/clips.css">\n    <link rel="stylesheet" href="assets/styles/ai-lab.css">'
  );
}

const block1 = /        \/\* =+\s*\n\s*AI LAB STYLES[\s\S]*?(?=        \/\* ─── Magic Preview Modal ─── \*\/)/;
const block2 = /        \/\* =+\s*\n\s*AI Breakdown Page V2 Styles[\s\S]*?(?=        \.files-section \{)/;

if (!block1.test(html)) console.warn('AI LAB block not found');
else html = html.replace(block1, '');

if (!block2.test(html)) console.warn('Breakdown V2 block not found');
else html = html.replace(block2, '');

fs.writeFileSync(popupPath, html);
console.log('Updated popup.html');
console.log('Has ai-lab link:', html.includes('ai-lab.css'));
console.log('Inline ai-lab-container:', html.includes('.ai-lab-container {'));
