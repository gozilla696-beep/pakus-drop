import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, View, Text, Pressable, StyleSheet, ScrollView, useWindowDimensions, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useAudioPlayer } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nextProgress, rankForLevel, stageForLevel, xpNeeded, fallDelayForLevel } from './src/game/progression';
import { PRODUCTS, grantPurchase, type Inventory } from './src/store/products';
import { Board, Piece, Cell, SpecialKind, COLS, ROWS, emptyBoard, randomPiece, rotate, collides, merge, clearLines, hardDropY, withGhost, blastBottom, clearHighestColumn, addGlitchRow, specialBlast, phaseCut } from './src/game/engine';

declare const require: (path: string) => any;

const SAVE_KEY = 'pakus-drop-save-v09';
const initialInventory: Inventory = { blast: 2, wildcard: 1, rescue: 1 };

export default function App() {
  const { width } = useWindowDimensions();
  const [board, setBoard] = useState<Board>(emptyBoard());
  const [piece, setPiece] = useState<Piece>(randomPiece());
  const [nextPiece, setNextPiece] = useState<Piece>(randomPiece());
  const [heldPiece, setHeldPiece] = useState<Piece | null>(null);
  const [canHold, setCanHold] = useState(true);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [best, setBest] = useState(0);
  const [linesTotal, setLinesTotal] = useState(0);
  const [combo, setCombo] = useState(0);
  const [locks, setLocks] = useState(0);
  const [pulseRow, setPulseRow] = useState<number | null>(null);
  const [pulseTurns, setPulseTurns] = useState(0);
  const [pulseWins, setPulseWins] = useState(0);
  const [pulseStreak, setPulseStreak] = useState(0);
  const [pakusModeTurns, setPakusModeTurns] = useState(0);
  const [pakusModeBest, setPakusModeBest] = useState(0);
  const [pakusModeActivations, setPakusModeActivations] = useState(0);
  const [missionsClaimed, setMissionsClaimed] = useState<Record<string, boolean>>({});
  const [inventory, setInventory] = useState<Inventory>(initialInventory);
  const [message, setMessage] = useState('Endlosmodus bereit.');
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [screen, setScreen] = useState<'home' | 'game' | 'missions'>('home');
  const [loaded, setLoaded] = useState(false);
  const rescuingRef = useRef(false);
  const modeGlow = useRef(new Animated.Value(0)).current;
  const pulseGlow = useRef(new Animated.Value(0)).current;
  const homeGlow = useRef(new Animated.Value(0.35)).current;
  const gameOverScale = useRef(new Animated.Value(0.75)).current;
  const [soundOn, setSoundOn] = useState(true);
  const [startCue, setStartCue] = useState<'READY' | 'DROP' | null>(null);
  const dropSfx = useAudioPlayer(require('./assets/sounds/drop.wav'));
  const clearSfx = useAudioPlayer(require('./assets/sounds/clear.wav'));
  const pulseSfx = useAudioPlayer(require('./assets/sounds/pulse.wav'));
  const modeSfx = useAudioPlayer(require('./assets/sounds/mode.wav'));
  const gameOverSfx = useAudioPlayer(require('./assets/sounds/gameover.wav'));

  const playSfx = useCallback((player: any) => {
    if (!soundOn) return;
    try { player.seekTo(0); player.play(); } catch {}
  }, [soundOn]);

  const rank = useMemo(() => rankForLevel(level), [level]);
  const stage = useMemo(() => stageForLevel(level), [level]);
  const display = useMemo(() => withGhost(board, piece), [board, piece]);
  const cell = Math.max(17, Math.min(31, Math.floor((width - 56) / COLS)));

  const maybeSpecial = useCallback((p: Piece, forceChance = 0): Piece => {
    const chance = Math.max(forceChance, pakusModeTurns > 0 ? 0.35 : pulseRow !== null ? 0.18 : 0.06);
    if (Math.random() > chance) return p;
    const kinds: SpecialKind[] = ['bomb', 'pulse', 'phase'];
    return { ...p, special: kinds[Math.floor(Math.random() * kinds.length)] };
  }, [pakusModeTurns, pulseRow]);

  const specialLabel = (kind?: SpecialKind) => kind === 'bomb' ? '💣 BOMB' : kind === 'pulse' ? '⚡ CORE' : kind === 'phase' ? '🌀 PHASE' : null;

  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(homeGlow, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(homeGlow, { toValue: 0.35, duration: 900, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [homeGlow]);

  useEffect(() => {
    if (!gameOver) { gameOverScale.setValue(0.75); return; }
    playSfx(gameOverSfx);
    Animated.spring(gameOverScale, { toValue: 1, friction: 5, tension: 85, useNativeDriver: true }).start();
  }, [gameOver, gameOverScale, gameOverSfx, playSfx]);

  const missionState = useMemo(() => [
    { id: 'lines5', title: '5 Linien löschen', progress: Math.min(linesTotal, 5), goal: 5, reward: '1 Blast' },
    { id: 'pulse2', title: '2 Pakus Pulses gewinnen', progress: Math.min(pulseWins, 2), goal: 2, reward: '1 Wild' },
    { id: 'mode1', title: 'Pakus Mode aktivieren', progress: Math.min(pakusModeActivations, 1), goal: 1, reward: '1 Rescue' },
  ], [linesTotal, pulseWins, pakusModeActivations]);

  useEffect(() => {
    if (pakusModeTurns <= 0) { modeGlow.setValue(0); return; }
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(modeGlow, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(modeGlow, { toValue: 0.15, duration: 420, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [pakusModeTurns, modeGlow]);

  useEffect(() => {
    if (pulseRow === null) { pulseGlow.setValue(0); return; }
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(pulseGlow, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(pulseGlow, { toValue: 0.25, duration: 300, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [pulseRow, pulseGlow]);

  useEffect(() => {
    AsyncStorage.getItem(SAVE_KEY).then(raw => {
      if (!raw) return;
      try {
        const s = JSON.parse(raw);
        if (typeof s.best === 'number') setBest(s.best);
        if (s.inventory) setInventory({ ...initialInventory, ...s.inventory });
        if (typeof s.pakusModeBest === 'number') setPakusModeBest(s.pakusModeBest);
        if (s.missionsClaimed) setMissionsClaimed(s.missionsClaimed);
        if (typeof s.soundOn === 'boolean') setSoundOn(s.soundOn);
      } catch {}
    }).finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(SAVE_KEY, JSON.stringify({ best, inventory, pakusModeBest, missionsClaimed, soundOn })).catch(() => {});
  }, [best, inventory, pakusModeBest, missionsClaimed, soundOn, loaded]);

  const rewardPoints = useCallback((points: number) => {
    const awarded = pakusModeTurns > 0 ? points * 2 : points;
    setScore(prev => {
      const next = prev + awarded;
      setBest(b => Math.max(b, next));
      return next;
    });
    setXp(prevXp => {
      const p = nextProgress(level, prevXp, awarded);
      if (p.leveledUp) {
        const levelsGained = p.level - level;
        setLevel(p.level);
        if (p.level % 3 === 0 || levelsGained > 1) {
          setInventory(inv => ({ ...inv, blast: inv.blast + 1 }));
          setMessage(`LEVEL ${p.level}! Gratis-Blast verdient.`);
        } else {
          setMessage(`LEVEL ${p.level}! Stufe ${stageForLevel(p.level)} · ${rankForLevel(p.level)}`);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      return p.xp;
    });
  }, [level, pakusModeTurns]);

  const normalizeSpawn = useCallback((p: Piece): Piece => ({
    ...p,
    x: Math.floor((COLS - p.shape[0].length) / 2),
    y: -1,
  }), []);

  const spawnNext = useCallback((nextBoard: Board) => {
    const next = normalizeSpawn(nextPiece);
    const queued = maybeSpecial(randomPiece());
    if (collides(nextBoard, next, 0, 1)) {
      if (inventory.rescue > 0 && !rescuingRef.current) {
        rescuingRef.current = true;
        setInventory(inv => ({ ...inv, rescue: inv.rescue - 1 }));
        const rescued = nextBoard.map((r, i) => i < 4 ? Array(COLS).fill(0) as Cell[] : [...r] as Cell[]);
        setBoard(rescued);
        setPiece(next);
        setNextPiece(queued);
        setCanHold(true);
        setMessage('🛟 Rescue hat Game Over verhindert!');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setTimeout(() => { rescuingRef.current = false; }, 250);
        return;
      }
      setGameOver(true);
      setMessage('GAME OVER · Neue Runde oder Booster-Shop.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setPiece(next);
    setNextPiece(queued);
    setCanHold(true);
  }, [inventory.rescue, nextPiece, normalizeSpawn, maybeSpecial]);

  function holdCurrent() {
    if (!canHold || gameOver || paused || shopOpen) return;
    const currentForHold = normalizeSpawn(piece);
    if (heldPiece) {
      const incoming = normalizeSpawn(heldPiece);
      if (collides(board, incoming, 0, 1)) {
        setMessage('HOLD gerade nicht möglich.');
        return;
      }
      setHeldPiece(currentForHold);
      setPiece(incoming);
    } else {
      setHeldPiece(currentForHold);
      setPiece(normalizeSpawn(nextPiece));
      setNextPiece(maybeSpecial(randomPiece()));
    }
    setCanHold(false);
    setMessage('🧊 HOLD benutzt · erst nach dem nächsten Lock wieder verfügbar.');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  const lockPiece = useCallback((locked: Piece) => {
    let merged = merge(board, locked);
    let specialBonus = 0;
    if (locked.special === 'bomb') {
      merged = specialBlast(merged, locked);
      specialBonus = 180 * level;
      setMessage('💣 PAKUS BOMB: 3×3-Zone gesprengt!');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (locked.special === 'phase') {
      merged = phaseCut(merged, locked);
      specialBonus = 140 * level;
      setMessage('🌀 PHASE BLOCK: blockierte Spalten angeschnitten!');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else if (locked.special === 'pulse') {
      specialBonus = 120 * level;
      if (pulseRow !== null) {
        setPulseTurns(t => Math.min(7, t + 2));
        setMessage('⚡ PULSE CORE: +2 Züge für den aktiven Pulse!');
      } else {
        setMessage('⚡ PULSE CORE: Energiebonus gesammelt.');
      }
    }
    const cleared = clearLines(merged);
    let nextBoard = cleared.board;
    const nextLocks = locks + 1;
    setLocks(nextLocks);

    const nextCombo = cleared.lines > 0 ? combo + 1 : 0;
    setCombo(nextCombo);
    const base = 35;
    const linePoints = [0, 120, 320, 600, 1000][cleared.lines] ?? cleared.lines * 300;
    const comboBonus = cleared.lines > 0 ? Math.min(5, nextCombo) * 60 * level : 0;
    let points = base + linePoints * level + comboBonus + specialBonus;

    let pulseHit = false;
    if (pulseRow !== null && cleared.clearedRows.includes(pulseRow)) {
      pulseHit = true;
      const bonus = 750 * level;
      points += bonus;
      setPulseWins(v => v + 1);
      const nextStreak = pulseStreak + 1;
      setPulseStreak(nextStreak);
      setPulseRow(null);
      setPulseTurns(0);
      setInventory(inv => ({ ...inv, wildcard: inv.wildcard + 1 }));
      if (nextStreak >= 3) {
        setPakusModeTurns(8);
        setPakusModeBest(v => Math.max(v, 8));
        setPakusModeActivations(v => v + 1);
        setPulseStreak(0);
        setMessage(`🔥 PAKUS MODE! 8 Blöcke lang doppelte Punkte + Shockwave-Clears!`);
        playSfx(modeSfx);
      } else {
        setMessage(`⚡ PAKUS PULSE ${nextStreak}/3! Zielreihe geknackt · +${bonus} · +1 Wild`);
        playSfx(pulseSfx);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (pulseRow !== null) {
      const turnsLeft = pulseTurns - 1;
      if (turnsLeft <= 0) {
        nextBoard = addGlitchRow(nextBoard);
        setPulseRow(null);
        setPulseTurns(0);
        setPulseStreak(0);
        setMessage('⚠️ Pulse verpasst: Glitch-Reihe steigt von unten! Pulse-Serie verloren.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        setPulseTurns(turnsLeft);
      }
    }

    if (cleared.lines > 0) {
      setLinesTotal(v => v + cleared.lines);
      if (!pulseHit) setMessage(`${cleared.lines} Reihe${cleared.lines > 1 ? 'n' : ''}! Combo ×${Math.max(1, nextCombo)} · +${points}`);
      playSfx(clearSfx);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    if (pulseRow === null && nextLocks > 0 && nextLocks % 6 === 0 && pakusModeTurns <= 0) {
      const target = ROWS - 3 - Math.floor(Math.random() * 5);
      setPulseRow(target);
      setPulseTurns(5);
      setMessage(`⚡ PAKUS PULSE: Leere die markierte Reihe in 5 Blöcken!`);
    }

    if (pakusModeTurns > 0) {
      const occupiedRows = nextBoard
        .map((row, y) => ({ y, filled: row.filter(Boolean).length }))
        .filter(r => r.filled > 0)
        .sort((a, b) => b.filled - a.filled);
      if (cleared.lines > 0 && occupiedRows.length) {
        const shockY = occupiedRows[0].y;
        const candidates = nextBoard[shockY].map((v, x) => v ? x : -1).filter(x => x >= 0);
        if (candidates.length) {
          const shockX = candidates[Math.floor(Math.random() * candidates.length)];
          nextBoard = nextBoard.map((r, y) => y === shockY ? r.map((v, x) => x === shockX ? 0 : v) as Cell[] : [...r] as Cell[]);
        }
      }
      const left = pakusModeTurns - 1;
      setPakusModeTurns(left);
      if (left === 0) setMessage('🔥 PAKUS MODE beendet. Nächste Pulse-Serie starten!');
    }

    setBoard(nextBoard);
    rewardPoints(points);
    spawnNext(nextBoard);
  }, [board, level, rewardPoints, spawnNext, locks, combo, pulseRow, pulseTurns, pulseStreak, pakusModeTurns, playSfx, clearSfx, pulseSfx, modeSfx]);

  const stepDown = useCallback(() => {
    if (gameOver || paused || shopOpen) return;
    if (!collides(board, piece, 0, 1)) {
      setPiece(p => ({ ...p, y: p.y + 1 }));
    } else {
      lockPiece(piece);
    }
  }, [board, piece, gameOver, paused, shopOpen, lockPiece]);

  useEffect(() => {
    if (gameOver || paused || shopOpen) return;
    const id = setTimeout(stepDown, fallDelayForLevel(level));
    return () => clearTimeout(id);
  }, [piece.y, piece.x, piece.shape, level, gameOver, paused, shopOpen, stepDown]);

  function move(dx: number) {
    if (gameOver || paused || shopOpen) return;
    if (!collides(board, piece, dx, 0)) {
      setPiece(p => ({ ...p, x: p.x + dx }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  function rotatePiece() {
    if (gameOver || paused || shopOpen) return;
    const r = rotate(piece.shape);
    if (!collides(board, piece, 0, 0, r)) setPiece(p => ({ ...p, shape: r }));
    else if (!collides(board, piece, -1, 0, r)) setPiece(p => ({ ...p, x: p.x - 1, shape: r }));
    else if (!collides(board, piece, 1, 0, r)) setPiece(p => ({ ...p, x: p.x + 1, shape: r }));
  }

  function hardDrop() {
    if (gameOver || paused || shopOpen) return;
    const y = hardDropY(board, piece);
    const distance = Math.max(0, y - piece.y);
    const dropped = { ...piece, y };
    if (distance) rewardPoints(distance * 2);
    playSfx(dropSfx);
    lockPiece(dropped);
  }

  function useBooster(kind: keyof Inventory) {
    if (inventory[kind] <= 0) { setMessage('Kein Booster mehr.'); return; }
    if (kind === 'blast') {
      setBoard(b => blastBottom(b));
      setInventory(i => ({ ...i, blast: i.blast - 1 }));
      rewardPoints(180);
      setMessage('💥 Blast: unterste belegte Reihe entfernt.');
    } else if (kind === 'wildcard') {
      setBoard(b => clearHighestColumn(b));
      setInventory(i => ({ ...i, wildcard: i.wildcard - 1 }));
      rewardPoints(140);
      setMessage('🌈 Wild: höchste Spalte geleert.');
    } else {
      setMessage('🛟 Rescue wird automatisch eingesetzt, wenn Game Over droht.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function demoPurchase(productId: string) {
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return;
    setInventory(i => grantPurchase(i, product));
    setMessage(`${product.title} hinzugefügt · Kauf ist in v0.5 noch Demo.`);
  }

  function claimMission(id: string) {
    const m = missionState.find(x => x.id === id);
    if (!m || m.progress < m.goal || missionsClaimed[id]) return;
    setMissionsClaimed(c => ({ ...c, [id]: true }));
    if (id === 'lines5') setInventory(i => ({ ...i, blast: i.blast + 1 }));
    if (id === 'pulse2') setInventory(i => ({ ...i, wildcard: i.wildcard + 1 }));
    if (id === 'mode1') setInventory(i => ({ ...i, rescue: i.rescue + 1 }));
    setMessage(`🎯 Mission geschafft: ${m.reward} verdient!`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function restart() {
    setBoard(emptyBoard()); setPiece(maybeSpecial(randomPiece(), 0.08)); setNextPiece(maybeSpecial(randomPiece(), 0.08)); setHeldPiece(null); setCanHold(true); setScore(0); setLevel(1); setXp(0); setLinesTotal(0); setCombo(0); setLocks(0); setPulseRow(null); setPulseTurns(0); setPulseWins(0); setPulseStreak(0); setPakusModeTurns(0); setPakusModeActivations(0);
    setGameOver(false); setPaused(false); setMessage('Neue Endlos-Runde gestartet.');
  }

  function startRun() {
    restart();
    setScreen('game');
    setPaused(true);
    setStartCue('READY');
    playSfx(pulseSfx);
    setTimeout(() => setStartCue('DROP'), 650);
    setTimeout(() => { setStartCue(null); setPaused(false); }, 1250);
  }

  if (screen === 'home') return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.home}>
        <Animated.View style={[styles.logoBadge, { transform: [{ scale: homeGlow.interpolate({ inputRange: [0.35, 1], outputRange: [0.98, 1.035] }) }] }]}><Text style={styles.logoMark}>P</Text></Animated.View>
        <Text style={styles.homeLogo}>PAKUS DROP</Text>
        <Text style={styles.homeTitle}>DROP. COMBO. BLAST.</Text>
        <Text style={styles.homeSub}>Triff Pakus Pulses, baue eine 3er-Serie auf und entfessle den PAKUS MODE.</Text>
        <View style={styles.homeCard}><Text style={styles.homeCardTitle}>DEIN ZIEL</Text><Text style={styles.homeCardText}>Überlebe so lange wie möglich · lösche Pulse-Reihen · nutze Spezialblöcke · knacke deinen Highscore.</Text></View>
        <Pressable style={styles.playBtn} onPress={startRun}><Text style={styles.playBtnText}>▶ SPIELEN</Text></Pressable>
        <Pressable style={styles.menuBtn} onPress={() => setScreen('missions')}><Text style={styles.menuBtnText}>🎯 MISSIONEN</Text></Pressable>
        <View style={styles.homeStats}><Text style={styles.homeStat}>BEST {best.toLocaleString('de-DE')}</Text><Text style={styles.homeStat}>BOOSTER {inventory.blast + inventory.wildcard + inventory.rescue}</Text></View>
        <View style={styles.soundRow}><Text style={styles.soundLabel}>SOUND</Text><Pressable onPress={() => setSoundOn(v => !v)} style={[styles.soundToggle, soundOn && styles.soundToggleOn]}><Text style={styles.soundToggleText}>{soundOn ? 'AN' : 'AUS'}</Text></Pressable></View>
        <Text style={styles.footer}>v0.9 · Pakus Drop</Text>
      </View>
    </SafeAreaView>
  );

  if (screen === 'missions') return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.page}>
        <Pressable onPress={() => setScreen('home')}><Text style={styles.back}>‹ ZURÜCK</Text></Pressable>
        <Text style={styles.title}>PAKUS MISSIONS</Text>
        <Text style={styles.sub}>Missionen geben dir Booster, ohne dass du etwas kaufen musst.</Text>
        <View style={styles.missions}>{missionState.map(m => { const done=m.progress>=m.goal; const claimed=!!missionsClaimed[m.id]; return <View key={m.id} style={styles.missionRow}><View style={{flex:1}}><Text style={styles.missionTitle}>{m.title}</Text><Text style={styles.missionMeta}>{m.progress}/{m.goal} · Belohnung: {m.reward}</Text></View><Pressable disabled={!done||claimed} onPress={() => claimMission(m.id)} style={[styles.claimBtn,(!done||claimed)&&styles.claimDisabled]}><Text style={styles.claimText}>{claimed?'GEHOLT':done?'HOLEN':'OFFEN'}</Text></Pressable></View>; })}</View>
        <View style={styles.homeCard}><Text style={styles.homeCardTitle}>BOOSTER-INVENTAR</Text><Text style={styles.homeCardText}>💥 Blast ×{inventory.blast}   🌈 Wild ×{inventory.wildcard}   🛟 Rescue ×{inventory.rescue}</Text></View>
        <Pressable style={styles.playBtn} onPress={startRun}><Text style={styles.playBtnText}>▶ RUN STARTEN</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.page} scrollEnabled={shopOpen}>
        <View style={styles.hero}>
          <Pressable onPress={() => { setPaused(true); setScreen('home'); }}><Text style={styles.back}>‹ MENÜ</Text></Pressable>
          <Text style={styles.kicker}>PAKUS DROP</Text>
          <Text style={styles.title}>DROP. COMBO. BLAST.</Text>
          <Text style={styles.sub}>Endlos · Pulse · Pakus Mode · Pakus Spezialblöcke · Missionen</Text>
        </View>

        <View style={styles.stats}>
          <Stat label="Score" value={score.toLocaleString('de-DE')} />
          <Stat label="Best" value={best.toLocaleString('de-DE')} />
          <Stat label="Level" value={`${level}`} />
          <Stat label="Linien" value={`${linesTotal}`} />
          <Stat label="Pulse" value={`${pulseWins}`} />
          <Stat label="Serie" value={`${pulseStreak}/3`} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardRow}><Text style={styles.rank}>{rank}</Text><Text style={styles.stage}>STUFE {stage}</Text></View>
          <Text style={styles.meta}>XP {xp} / {xpNeeded(level)} · Falltempo {fallDelayForLevel(level)} ms · Combo ×{combo}</Text>
          {pakusModeTurns > 0 && <View style={styles.modeBox}><Text style={styles.modeTitle}>🔥 PAKUS MODE</Text><Text style={styles.modeText}>Noch {pakusModeTurns} Blöcke · 2× Punkte · Shockwave bei Linien-Clear</Text></View>}
          {pulseRow !== null && <View style={styles.pulseBox}><Text style={styles.pulseTitle}>⚡ PAKUS PULSE</Text><Text style={styles.pulseText}>Markierte Reihe löschen · noch {pulseTurns} Block{pulseTurns === 1 ? '' : 'e'}</Text></View>}
          <View style={styles.progressBg}><View style={[styles.progressFg, { width: `${Math.min(100, xp/xpNeeded(level)*100)}%` }]} /></View>
          <Text style={styles.message}>{paused ? 'PAUSE' : message}</Text>
        </View>

        <View style={styles.previewRow}>
          <PreviewPiece title="HOLD" piece={heldPiece} disabled={!canHold} onPress={holdCurrent} />
          <View style={styles.previewCenter}>
            <Text style={styles.previewHint}>Planen statt nur reagieren</Text>
            <Text style={styles.previewHintSub}>{canHold ? 'Hold verfügbar' : 'Hold nach Lock wieder frei'}</Text>
          </View>
          <PreviewPiece title="NEXT" piece={nextPiece} />
        </View>

        {piece.special && <View style={styles.specialBanner}><Text style={styles.specialBannerTitle}>{specialLabel(piece.special)}</Text><Text style={styles.specialBannerText}>{piece.special === 'bomb' ? 'Beim Lock explodiert eine 3×3-Zone.' : piece.special === 'phase' ? 'Beim Lock schneidet er blockierte Spalten an.' : 'Beim Lock gibt er Pulse-Energie und verlängert einen aktiven Pulse.'}</Text></View>}

        <View style={styles.boardWrap}>
          <Animated.View
            style={[
              styles.board,
              { width: cell * COLS + 2, height: cell * ROWS + 2 },
              pakusModeTurns > 0 ? {
                transform: [{
                  scale: modeGlow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.012] }),
                }],
              } : null,
            ]}
          >
            {pakusModeTurns > 0 && <Animated.View pointerEvents="none" style={[styles.modeAura, { opacity: modeGlow }]} />}
            {pulseRow !== null && <Animated.View pointerEvents="none" style={[styles.pulseAura, { opacity: pulseGlow }]} />}
            {display.map((row, y) => row.map((v, x) => {
              let value: Cell = v;
              const sy = y - piece.y, sx = x - piece.x;
              if (sy >= 0 && sx >= 0 && sy < piece.shape.length && sx < piece.shape[sy].length && piece.shape[sy][sx]) value = piece.color;
              const isPulse = pulseRow === y;
              return <View key={`${x}-${y}`} style={[styles.cell, { width: cell - 1, height: cell - 1 }, value ? cellStyles[value] : styles.emptyCell, isPulse && styles.pulseCell]} />;
            }))}
            {gameOver && <Animated.View style={[styles.overlay, { transform: [{ scale: gameOverScale }] }]}><Text style={styles.overlayBig}>GAME OVER</Text><Text style={styles.overlaySmall}>Score {score.toLocaleString('de-DE')} · Best {best.toLocaleString('de-DE')}</Text><Text style={styles.overlayHint}>Noch ein Run?</Text></Animated.View>}
          </Animated.View>
        </View>

        {startCue && <View style={styles.startOverlay}><Text style={styles.startCue}>{startCue}</Text><Text style={styles.startSub}>{startCue === 'READY' ? 'Pakus-System online' : 'GO!'}</Text></View>}

        <View style={styles.controls}>
          <Control label="◀" onPress={() => move(-1)} />
          <Control label="↻" onPress={rotatePiece} />
          <Control label="HOLD" onPress={holdCurrent} disabled={!canHold} />
          <Control label="▼" onPress={stepDown} />
          <Control label="DROP" onPress={hardDrop} wide />
          <Control label="▶" onPress={() => move(1)} />
        </View>

        <View style={styles.actions}>
          <GameButton label={`💥 Blast ×${inventory.blast}`} onPress={() => useBooster('blast')} />
          <GameButton label={`🌈 Wild ×${inventory.wildcard}`} onPress={() => useBooster('wildcard')} />
          <GameButton label={`🛟 Rescue ×${inventory.rescue}`} onPress={() => useBooster('rescue')} />
        </View>

        <View style={styles.missions}>
          <View style={styles.cardRow}><Text style={styles.sectionTitle}>PAKUS MISSIONS</Text><Text style={styles.missionTag}>RUN</Text></View>
          {missionState.map(m => {
            const done = m.progress >= m.goal;
            const claimed = !!missionsClaimed[m.id];
            return <View key={m.id} style={styles.missionRow}>
              <View style={{ flex: 1 }}><Text style={styles.missionTitle}>{m.title}</Text><Text style={styles.missionMeta}>{m.progress}/{m.goal} · Belohnung: {m.reward}</Text></View>
              <Pressable disabled={!done || claimed} onPress={() => claimMission(m.id)} style={[styles.claimBtn, (!done || claimed) && styles.claimDisabled]}><Text style={styles.claimText}>{claimed ? 'GEHOLT' : done ? 'HOLEN' : 'OFFEN'}</Text></Pressable>
            </View>;
          })}
        </View>

        <View style={styles.rowButtons}>
          <Pressable style={styles.secondary} onPress={() => setPaused(p => !p)}><Text style={styles.secondaryText}>{paused ? 'Weiter' : 'Pause'}</Text></Pressable>
          <Pressable style={styles.shopBtn} onPress={() => { setShopOpen(s => !s); setPaused(true); }}><Text style={styles.shopBtnText}>{shopOpen ? 'Shop schließen' : 'Shop'}</Text></Pressable>
          <Pressable style={styles.secondary} onPress={restart}><Text style={styles.secondaryText}>Neu</Text></Pressable>
        </View>

        {shopOpen && <View style={styles.shop}>
          <Text style={styles.sectionTitle}>Booster-Shop</Text>
          <Text style={styles.shopNote}>0,99–1,99 € · in dieser Version noch Demo. Booster sind auch erspielbar.</Text>
          {PRODUCTS.map(p => <View key={p.id} style={styles.product}>
            <View style={{ flex: 1 }}><Text style={styles.productTitle}>{p.title}</Text><Text style={styles.productDesc}>{p.description}</Text></View>
            <Pressable style={styles.buy} onPress={() => demoPurchase(p.id)}><Text style={styles.buyText}>{p.priceLabel}</Text></Pressable>
          </View>)}
        </View>}

        <Text style={styles.footer}>v0.9 · Polish-Pass: Audio, Start-Cue, Game-Over-Animation, Pakus-Logo und iPhone/TestFlight-Build-Konfiguration.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>;
}
function Control({ label, onPress, wide, disabled }: { label: string; onPress: () => void; wide?: boolean; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={[styles.control, wide && styles.controlWide, disabled && styles.controlDisabled]}><Text style={styles.controlText}>{label}</Text></Pressable>;
}

function PreviewPiece({ title, piece, disabled, onPress }: { title: string; piece: Piece | null; disabled?: boolean; onPress?: () => void }) {
  const box = (
    <View style={[styles.previewBox, disabled && styles.previewDisabled]}>
      <Text style={styles.previewTitle}>{title}</Text>
      <View style={styles.miniGrid}>
        {piece ? piece.shape.map((row, y) => (
          <View key={`r-${y}`} style={styles.miniRow}>
            {row.map((v, x) => <View key={`${x}-${y}`} style={[styles.miniCell, v ? cellStyles[piece.color] : styles.miniEmpty]} />)}
          </View>
        )) : <Text style={styles.previewEmpty}>—</Text>}
      </View>
    </View>
  );
  return onPress ? <Pressable onPress={onPress} disabled={disabled}>{box}</Pressable> : box;
}
function GameButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable style={styles.gameBtn} onPress={onPress}><Text style={styles.gameBtnText}>{label}</Text></Pressable>;
}

const cellStyles: Record<number, any> = {
  1: { backgroundColor: '#3a36ff' }, 2: { backgroundColor: '#ff2ba6' }, 3: { backgroundColor: '#d8ff00' },
  4: { backgroundColor: '#00e7ff' }, 5: { backgroundColor: '#ff8a1f' }, 6: { backgroundColor: '#9d5cff' },
  7: { backgroundColor: '#282844', opacity: 0.55 },
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080817' }, home: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 }, logoBadge: { width: 92, height: 92, borderRadius: 26, borderWidth: 4, borderColor: '#d8ff00', backgroundColor: '#14142a', alignItems: 'center', justifyContent: 'center', shadowColor: '#d8ff00', shadowOpacity: 0.45, shadowRadius: 18 }, logoMark: { color: '#ff2ba6', fontWeight: '900', fontSize: 54, fontStyle: 'italic' }, homeLogo: { color: '#d8ff00', fontWeight: '900', letterSpacing: 4, fontSize: 16 }, homeTitle: { color: 'white', fontWeight: '900', fontSize: 42, lineHeight: 43 }, homeSub: { color: '#b4b4cf', fontSize: 16, lineHeight: 22 }, homeCard: { backgroundColor: '#14142a', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#303052' }, homeCardTitle: { color: '#ff5cf4', fontWeight: '900', fontSize: 12, letterSpacing: 2 }, homeCardText: { color: 'white', marginTop: 8, lineHeight: 20, fontWeight: '600' }, playBtn: { backgroundColor: '#d8ff00', borderRadius: 16, paddingVertical: 17, alignItems: 'center' }, playBtnText: { color: '#080817', fontWeight: '900', fontSize: 18 }, menuBtn: { backgroundColor: '#3a36ff', borderRadius: 16, paddingVertical: 15, alignItems: 'center' }, menuBtnText: { color: 'white', fontWeight: '900', fontSize: 15 }, homeStats: { flexDirection: 'row', justifyContent: 'space-between' }, homeStat: { color: '#8e8eae', fontWeight: '800', fontSize: 11 }, back: { color: '#00e7ff', fontWeight: '900', marginBottom: 8 }, page: { padding: 14, paddingBottom: 42, gap: 12, alignItems: 'stretch' },
  hero: { paddingTop: 6 }, kicker: { color: '#d8ff00', fontWeight: '900', letterSpacing: 3 },
  title: { color: 'white', fontWeight: '900', fontSize: 30, lineHeight: 32, marginTop: 4 }, sub: { color: '#a8a8c7', marginTop: 5 },
  stats: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' }, stat: { minWidth: '18%', flexGrow: 1, backgroundColor: '#14142a', padding: 9, borderRadius: 12 },
  statLabel: { color: '#8e8eae', fontSize: 10 }, statValue: { color: 'white', fontWeight: '900', fontSize: 16, marginTop: 2 },
  card: { backgroundColor: '#14142a', padding: 12, borderRadius: 16 }, cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rank: { color: '#ff5cf4', fontWeight: '900', fontSize: 18 }, stage: { color: '#d8ff00', fontWeight: '900', fontSize: 12 },
  meta: { color: '#b4b4cf', marginTop: 4, fontSize: 11 }, message: { color: 'white', marginTop: 9, fontWeight: '700', fontSize: 12 },
  progressBg: { height: 7, backgroundColor: '#252543', borderRadius: 99, marginTop: 8, overflow: 'hidden' }, progressFg: { height: 7, backgroundColor: '#d8ff00' },
  pulseBox: { marginTop: 10, backgroundColor: '#252000', borderWidth: 1, borderColor: '#d8ff00', borderRadius: 10, padding: 9 }, pulseTitle: { color: '#d8ff00', fontWeight: '900', fontSize: 12 }, pulseText: { color: 'white', fontSize: 11, marginTop: 2 },
  modeBox: { marginTop: 10, backgroundColor: '#35112f', borderWidth: 1, borderColor: '#ff5cf4', borderRadius: 10, padding: 10 }, modeTitle: { color: '#ff5cf4', fontWeight: '900', fontSize: 13 }, modeText: { color: 'white', fontSize: 11, marginTop: 2 },
  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  previewBox: { width: 88, minHeight: 82, backgroundColor: '#14142a', borderRadius: 14, borderWidth: 1, borderColor: '#303052', padding: 8, alignItems: 'center' }, previewDisabled: { opacity: 0.45 },
  previewTitle: { color: '#d8ff00', fontWeight: '900', fontSize: 10, letterSpacing: 1.5 }, previewCenter: { flex: 1, alignItems: 'center' }, previewHint: { color: 'white', fontWeight: '800', fontSize: 11, textAlign: 'center' }, previewHintSub: { color: '#8e8eae', fontSize: 9, marginTop: 3, textAlign: 'center' },
  miniGrid: { marginTop: 7, minHeight: 36, minWidth: 50, alignItems: 'center', justifyContent: 'center' }, miniRow: { flexDirection: 'row' }, miniCell: { width: 12, height: 12, margin: 1, borderRadius: 2 }, miniEmpty: { backgroundColor: 'transparent' }, previewEmpty: { color: '#777795', fontSize: 20 },
  boardWrap: { alignItems: 'center' }, board: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#101023', borderWidth: 1, borderColor: '#2d2d4a', position: 'relative' },
  modeAura: { ...StyleSheet.absoluteFillObject, borderWidth: 3, borderColor: '#ff5cf4', zIndex: 5 }, pulseAura: { ...StyleSheet.absoluteFillObject, borderWidth: 2, borderColor: '#d8ff00', zIndex: 4 },
  cell: { marginRight: 1, marginBottom: 1 }, emptyCell: { backgroundColor: '#121228' }, pulseCell: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#d8ff00' },
  overlay: { position: 'absolute', left: 0, right: 0, top: '40%', backgroundColor: 'rgba(8,8,23,0.88)', paddingVertical: 18, alignItems: 'center' },
  overlayBig: { color: '#ff5cf4', fontWeight: '900', fontSize: 26 }, overlaySmall: { color: 'white', marginTop: 5, fontWeight: '700' }, overlayHint: { color: '#d8ff00', marginTop: 8, fontWeight: '900', letterSpacing: 1 },
  startOverlay: { position: 'absolute', left: 28, right: 28, top: '45%', zIndex: 50, backgroundColor: 'rgba(8,8,23,0.94)', borderWidth: 2, borderColor: '#d8ff00', borderRadius: 22, paddingVertical: 24, alignItems: 'center' }, startCue: { color: '#d8ff00', fontWeight: '900', fontSize: 38, letterSpacing: 4 }, startSub: { color: '#ff5cf4', fontWeight: '900', marginTop: 5 }, soundRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }, soundLabel: { color: '#8e8eae', fontWeight: '900', fontSize: 11 }, soundToggle: { backgroundColor: '#252543', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7 }, soundToggleOn: { backgroundColor: '#d8ff00' }, soundToggleText: { color: '#080817', fontWeight: '900', fontSize: 10 }, controls: { flexDirection: 'row', gap: 6, justifyContent: 'center' }, control: { flex: 1, backgroundColor: '#202041', paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  controlWide: { flex: 1.35, backgroundColor: '#3a36ff' }, controlDisabled: { opacity: 0.35 }, controlText: { color: 'white', fontWeight: '900', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 6 }, gameBtn: { flex: 1, backgroundColor: '#1b1b36', borderRadius: 12, paddingVertical: 11, alignItems: 'center' }, gameBtnText: { color: 'white', fontWeight: '800', fontSize: 11 },
  rowButtons: { flexDirection: 'row', gap: 7 }, secondary: { flex: 1, borderWidth: 1, borderColor: '#3a3a5c', padding: 12, borderRadius: 12, alignItems: 'center' }, secondaryText: { color: 'white', fontWeight: '800' },
  shopBtn: { flex: 1, backgroundColor: '#d8ff00', padding: 12, borderRadius: 12, alignItems: 'center' }, shopBtnText: { color: '#080817', fontWeight: '900' },
  shop: { backgroundColor: '#14142a', borderRadius: 16, padding: 14, gap: 9 }, sectionTitle: { color: 'white', fontSize: 20, fontWeight: '900' }, shopNote: { color: '#aaaac6', fontSize: 12 },
  product: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#1d1d38', padding: 11, borderRadius: 12 }, productTitle: { color: 'white', fontWeight: '900' }, productDesc: { color: '#a8a8c7', fontSize: 11, marginTop: 2 },
  buy: { backgroundColor: '#ff5cf4', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 }, buyText: { color: '#0a0a17', fontWeight: '900' },
  specialBanner: { backgroundColor: '#18263a', borderWidth: 1, borderColor: '#00e7ff', borderRadius: 14, padding: 10 }, specialBannerTitle: { color: '#00e7ff', fontWeight: '900', fontSize: 13 }, specialBannerText: { color: 'white', fontSize: 11, marginTop: 3 },
  missions: { backgroundColor: '#14142a', borderRadius: 16, padding: 12, gap: 8 }, missionTag: { color: '#080817', backgroundColor: '#d8ff00', fontWeight: '900', fontSize: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99 }, missionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1d1d38', padding: 10, borderRadius: 11 }, missionTitle: { color: 'white', fontWeight: '800', fontSize: 12 }, missionMeta: { color: '#a8a8c7', fontSize: 10, marginTop: 2 }, claimBtn: { backgroundColor: '#3a36ff', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9 }, claimDisabled: { opacity: 0.35 }, claimText: { color: 'white', fontWeight: '900', fontSize: 9 }, footer: { color: '#696988', fontSize: 10, textAlign: 'center', lineHeight: 14 },
});
