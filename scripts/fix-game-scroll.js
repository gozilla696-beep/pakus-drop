const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'App.tsx');
const source = fs.readFileSync(appPath, 'utf8');
const oldLine = '<ScrollView contentContainerStyle={styles.page} scrollEnabled={shopOpen}>';
const newLine = '<ScrollView contentContainerStyle={styles.page} scrollEnabled>';

if (source.includes(oldLine)) {
  fs.writeFileSync(appPath, source.replace(oldLine, newLine), 'utf8');
  console.log('Pakus Drop: game screen scrolling enabled.');
} else if (source.includes(newLine)) {
  console.log('Pakus Drop: game screen scrolling already enabled.');
} else {
  throw new Error('Pakus Drop scroll target not found in App.tsx');
}
