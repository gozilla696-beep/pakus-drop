const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'App.tsx');
let source = fs.readFileSync(appPath, 'utf8');

const oldScroll = '<ScrollView contentContainerStyle={styles.page} scrollEnabled={shopOpen}>';
const enabledScroll = '<ScrollView contentContainerStyle={styles.page} scrollEnabled>';
if (source.includes(oldScroll)) {
  source = source.replace(oldScroll, enabledScroll);
}

const oldDimensions = 'const { width } = useWindowDimensions();';
const newDimensions = 'const { width, height } = useWindowDimensions();';
if (source.includes(oldDimensions)) {
  source = source.replace(oldDimensions, newDimensions);
}

const oldCell = 'const cell = Math.max(17, Math.min(31, Math.floor((width - 56) / COLS)));';
const newCell = 'const cell = Math.max(17, Math.min(31, Math.floor((width - 56) / COLS), Math.floor((height - 460) / ROWS)));';
if (source.includes(oldCell)) {
  source = source.replace(oldCell, newCell);
}

if (!source.includes(enabledScroll)) {
  throw new Error('Pakus Drop scroll target not found in App.tsx');
}
if (!source.includes(newDimensions)) {
  throw new Error('Pakus Drop responsive height target not found in App.tsx');
}
if (!source.includes(newCell)) {
  throw new Error('Pakus Drop responsive cell target not found in App.tsx');
}

fs.writeFileSync(appPath, source, 'utf8');
console.log('Pakus Drop: scrolling enabled and board fitted to iPhone height.');
