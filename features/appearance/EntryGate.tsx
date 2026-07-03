import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { useSessionStore } from '@/store/localStore';

import { verifyPin } from './guard';
import { keypadCandidates, noteCandidates } from './matchSequence';
import { getFamilyLabel } from './profiles.data';
import type { EntryGuardMode } from '@/store/localStore';

interface EntryGateProps {
  mode: EntryGuardMode;
}

/**
 * Full-screen entry surface shown before the app when the guard is engaged.
 * Renders a working keypad ('A') or a working note pad ('B'). Performing the
 * agreed action reveals the app; otherwise each surface behaves like the
 * ordinary utility it appears to be. Component and prop names stay generic.
 */
export function EntryGate({ mode }: EntryGateProps) {
  const unlock = useSessionStore((s) => s.unlock);
  // RootLayout keeps the splash up until the app is ready; when the guard takes
  // over instead, hide it here so the surface is visible.
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);
  return mode === 'B' ? (
    <NoteSurface onUnlock={unlock} />
  ) : (
    <KeypadSurface onUnlock={unlock} />
  );
}

// A candidate is only considered when it is a plausible short numeric/text
// sequence, so verification does not run on every keystroke.
const MIN_LEN = 4;
const MAX_LEN = 12;

function useCandidateCheck(onUnlock: () => void) {
  return useCallback(
    async (candidate: string) => {
      if (candidate.length < MIN_LEN || candidate.length > MAX_LEN) {
        return false;
      }
      const ok = await verifyPin(candidate);
      if (ok) onUnlock();
      return ok;
    },
    [onUnlock]
  );
}

/* -------------------------------------------------------------------------- */
/* Keypad surface                                                              */
/* -------------------------------------------------------------------------- */

type Op = '+' | '-' | '×' | '÷';

function KeypadSurface({ onUnlock }: { onUnlock: () => void }) {
  const check = useCandidateCheck(onUnlock);
  const [display, setDisplay] = useState('0');
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [fresh, setFresh] = useState(true);
  // Running record of digits typed since the last commit, for sequence checks.
  const [buffer, setBuffer] = useState('');

  const pushDigit = useCallback(
    (d: string) => {
      setBuffer((b) => (b + d).slice(-MAX_LEN));
      setDisplay((prev) => {
        if (fresh || prev === '0') {
          setFresh(false);
          return d;
        }
        if (prev.replace(/[^0-9]/g, '').length >= 15) return prev;
        return prev + d;
      });
    },
    [fresh]
  );

  const applyOp = useCallback(
    (next: Op) => {
      const current = parseFloat(display) || 0;
      if (acc === null) {
        setAcc(current);
      } else if (op) {
        setAcc(compute(acc, current, op));
      }
      setOp(next);
      setFresh(true);
    },
    [acc, display, op]
  );

  const equals = useCallback(async () => {
    // Secret-sequence check happens on commit, before arithmetic. Try each
    // trailing window (longest first) so earlier arithmetic can't block a match.
    for (const candidate of keypadCandidates(buffer, MIN_LEN, MAX_LEN)) {
      if (await check(candidate)) return;
    }

    if (op !== null && acc !== null) {
      const current = parseFloat(display) || 0;
      const result = compute(acc, current, op);
      setDisplay(formatResult(result));
      setAcc(null);
      setOp(null);
      setFresh(true);
    }
    setBuffer('');
  }, [acc, buffer, check, display, op]);

  const clearAll = useCallback(() => {
    setDisplay('0');
    setAcc(null);
    setOp(null);
    setFresh(true);
    setBuffer('');
  }, []);

  const toggleSign = useCallback(() => {
    setDisplay((p) => (p.startsWith('-') ? p.slice(1) : p === '0' ? p : `-${p}`));
  }, []);

  const percent = useCallback(() => {
    setDisplay((p) => formatResult((parseFloat(p) || 0) / 100));
    setFresh(true);
  }, []);

  const dot = useCallback(() => {
    setDisplay((p) => (p.includes('.') ? p : `${p}.`));
    setFresh(false);
  }, []);

  const rows: KeyDef[][] = useMemo(
    () => [
      [
        { label: 'AC', kind: 'fn', onPress: clearAll },
        { label: '+/−', kind: 'fn', onPress: toggleSign },
        { label: '%', kind: 'fn', onPress: percent },
        { label: '÷', kind: 'op', onPress: () => applyOp('÷') }
      ],
      [
        { label: '7', kind: 'num', onPress: () => pushDigit('7') },
        { label: '8', kind: 'num', onPress: () => pushDigit('8') },
        { label: '9', kind: 'num', onPress: () => pushDigit('9') },
        { label: '×', kind: 'op', onPress: () => applyOp('×') }
      ],
      [
        { label: '4', kind: 'num', onPress: () => pushDigit('4') },
        { label: '5', kind: 'num', onPress: () => pushDigit('5') },
        { label: '6', kind: 'num', onPress: () => pushDigit('6') },
        { label: '−', kind: 'op', onPress: () => applyOp('-') }
      ],
      [
        { label: '1', kind: 'num', onPress: () => pushDigit('1') },
        { label: '2', kind: 'num', onPress: () => pushDigit('2') },
        { label: '3', kind: 'num', onPress: () => pushDigit('3') },
        { label: '+', kind: 'op', onPress: () => applyOp('+') }
      ],
      [
        { label: '0', kind: 'num', wide: true, onPress: () => pushDigit('0') },
        { label: '.', kind: 'num', onPress: dot },
        { label: '=', kind: 'op', onPress: () => void equals() }
      ]
    ],
    [applyOp, clearAll, dot, equals, percent, pushDigit, toggleSign]
  );

  return (
    <SafeAreaView style={kp.safe}>
      <StatusBar barStyle="light-content" />
      <View style={kp.displayWrap}>
        <Text style={kp.display} numberOfLines={1} adjustsFontSizeToFit>
          {display}
        </Text>
      </View>
      <View style={kp.pad}>
        {rows.map((row, ri) => (
          <View style={kp.row} key={ri}>
            {row.map((k) => (
              <Key key={k.label} def={k} />
            ))}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

interface KeyDef {
  label: string;
  kind: 'num' | 'op' | 'fn';
  wide?: boolean;
  onPress: () => void;
}

function Key({ def }: { def: KeyDef }) {
  const bg =
    def.kind === 'op' ? '#ff9f0a' : def.kind === 'fn' ? '#5b5b5f' : '#333336';
  const color = def.kind === 'fn' ? '#000' : '#fff';
  return (
    <Pressable
      onPress={def.onPress}
      style={({ pressed }) => [
        kp.key,
        def.wide && kp.keyWide,
        { backgroundColor: bg, opacity: pressed ? 0.7 : 1 }
      ]}
    >
      <Text style={[kp.keyLabel, { color }]}>{def.label}</Text>
    </Pressable>
  );
}

function compute(a: number, b: number, op: Op): number {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      return b === 0 ? 0 : a / b;
  }
}

function formatResult(n: number): string {
  if (!isFinite(n)) return '0';
  const rounded = Math.round(n * 1e10) / 1e10;
  return String(rounded);
}

/* -------------------------------------------------------------------------- */
/* Note surface                                                                */
/* -------------------------------------------------------------------------- */

function NoteSurface({ onUnlock }: { onUnlock: () => void }) {
  const check = useCandidateCheck(onUnlock);
  const [text, setText] = useState('');
  const title = getFamilyLabel('B');

  const onChange = useCallback(
    (value: string) => {
      setText(value);
      for (const candidate of noteCandidates(value)) {
        void check(candidate);
      }
    },
    [check]
  );

  return (
    <SafeAreaView style={nt.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={nt.header}>
        <Text style={nt.title}>{title}</Text>
      </View>
      <KeyboardAvoidingView
        style={nt.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TextInput
          style={nt.input}
          value={text}
          onChangeText={onChange}
          multiline
          autoCorrect={false}
          autoCapitalize="sentences"
          placeholder="Start typing…"
          placeholderTextColor="#b0b0b0"
          textAlignVertical="top"
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const kp = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  displayWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 12
  },
  display: { color: '#fff', fontSize: 72, fontWeight: '300' },
  pad: { paddingHorizontal: 8, paddingBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  key: {
    flex: 1,
    aspectRatio: 1,
    margin: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center'
  },
  keyWide: { flex: 2.15, aspectRatio: undefined, alignItems: 'flex-start', paddingLeft: 32 },
  keyLabel: { fontSize: 32, fontWeight: '500' }
});

const nt = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fdfdf7' },
  fill: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e2d8'
  },
  title: { fontSize: 30, fontWeight: '700', color: '#1c1c1e' },
  input: {
    flex: 1,
    fontSize: 18,
    lineHeight: 26,
    color: '#1c1c1e',
    paddingHorizontal: 20,
    paddingVertical: 16
  }
});
