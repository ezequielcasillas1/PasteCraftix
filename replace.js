const fs = require('fs');
let content = fs.readFileSync('extension/popup.js', 'utf8');
const start = content.indexOf('  async loadData() {');
const end = content.indexOf('  /**', start);
if (start !== -1 && end !== -1) {
  const oldStr = content.substring(start, end);
  const newStr = '  async loadData() {\r\n    return this.syncFeature?.loader?.loadData?.(this);\r\n  }\r\n\r\n';
  content = content.replace(oldStr, newStr);
  fs.writeFileSync('extension/popup.js', content);
  console.log('Replaced successfully');
} else {
  console.log('Could not find start or end', start, end);
}