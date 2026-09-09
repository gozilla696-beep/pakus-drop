const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'App.tsx');
let source = fs.readFileSync(appPath, 'utf8');

// Keep the game screen scrollable on iPhone.
const oldScroll = '<ScrollView contentContainerStyle={styles.page} scrollEnabled={shopOpen}>';
const enabledScroll = '<ScrollView contentContainerStyle={styles.page} scrollEnabled>';
if (source.includes(oldScroll)) {
  source = source.replace(oldScroll, enabledScroll);
}

// Fit the board to the available iPhone height so the controls remain reachable.
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

// Build 17 reached TestFlight but showed a permanent black screen on launch.
// The app creates five expo-audio native players before the first screen can render.
// Temporarily disable those native audio players in production so a native audio
// initialization failure cannot prevent the UI from mounting. Haptics and the
// rest of the game remain unchanged; sound can be re-enabled after startup is stable.
source = source.replace("import { useAudioPlayer } from 'expo-audio';\n", '');
source = source.replace("  const dropSfx = useAudioPlayer(require('./assets/sounds/drop.wav'));\n", '  const dropSfx = null;\n');
source = source.replace("  const clearSfx = useAudioPlayer(require('./assets/sounds/clear.wav'));\n", '  const clearSfx = null;\n');
source = source.replace("  const pulseSfx = useAudioPlayer(require('./assets/sounds/pulse.wav'));\n", '  const pulseSfx = null;\n');
source = source.replace("  const modeSfx = useAudioPlayer(require('./assets/sounds/mode.wav'));\n", '  const modeSfx = null;\n');
source = source.replace("  const gameOverSfx = useAudioPlayer(require('./assets/sounds/gameover.wav'));\n", '  const gameOverSfx = null;\n');

const oldPlaySfx = `  const playSfx = useCallback((player: any) => {\n    if (!soundOn) return;\n    try { player.seekTo(0); player.play(); } catch {}\n  }, [soundOn]);`;
const safePlaySfx = `  const playSfx = useCallback((_player: any) => {\n    // Audio temporarily disabled to guarantee reliable TestFlight startup.\n  }, []);`;
if (source.includes(oldPlaySfx)) {
  source = source.replace(oldPlaySfx, safePlaySfx);
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
if (source.includes('useAudioPlayer(')) {
  throw new Error('Pakus Drop startup guard failed: expo-audio player still active');
}

fs.writeFileSync(appPath, source, 'utf8');
console.log('Pakus Drop: scrolling/height fix applied; startup audio guarded for TestFlight.');
