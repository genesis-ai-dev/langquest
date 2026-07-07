import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets
} from 'react-native-safe-area-context';

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
 *
 * Mounted before the app's providers, so it carries its own SafeAreaProvider —
 * the OS status/navigation bars must never cover interactive keys (a hidden
 * "=" key would lock the owner out permanently).
 */
export function EntryGate({ mode }: EntryGateProps) {
  const unlock = useSessionStore((s) => s.unlock);
  // RootLayout keeps the splash up until the app is ready; when the guard takes
  // over instead, hide it here so the surface is visible.
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);
  return (
    <SafeAreaProvider>
      {mode === 'B' ? (
        <NoteSurface onUnlock={unlock} />
      ) : (
        <KeypadSurface onUnlock={unlock} />
      )}
    </SafeAreaProvider>
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

const PAD_H_PADDING = 14;
const KEY_GAP = 12;
const MAX_KEY_SIZE = 92;
const MAX_DIGITS = 12;

function KeypadSurface({ onUnlock }: { onUnlock: () => void }) {
  const check = useCandidateCheck(onUnlock);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const keySize = Math.min(
    (width - PAD_H_PADDING * 2 - KEY_GAP * 3) / 4,
    MAX_KEY_SIZE
  );

  const [display, setDisplay] = useState('0');
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [fresh, setFresh] = useState(true);
  // Running record of digits typed since the last commit, for sequence checks.
  const [buffer, setBuffer] = useState('');

  const pushDigit = useCallback(
    (d: string) => {
      const next = (buffer + d).slice(-MAX_LEN);
      setBuffer(next);
      // The secret is checked on every keystroke, so typing it alone unlocks —
      // no extra key press that the owner could forget (or that a broken/hidden
      // key could make unreachable). Trailing windows are tried longest-first
      // so digits typed earlier (e.g. real arithmetic) don't block a match.
      for (const candidate of keypadCandidates(next, MIN_LEN, MAX_LEN)) {
        void check(candidate);
      }
      setDisplay((prev) => {
        if (fresh || prev === '0') {
          setFresh(false);
          return d;
        }
        if (prev.replace(/[^0-9]/g, '').length >= MAX_DIGITS) return prev;
        return prev + d;
      });
    },
    [buffer, check, fresh]
  );

  const backspace = useCallback(() => {
    // Also trims the sequence buffer so a mistyped secret can be corrected.
    setBuffer((b) => b.slice(0, -1));
    setDisplay((prev) => {
      if (fresh) return prev;
      if (prev.length <= 1 || (prev.length === 2 && prev.startsWith('-'))) {
        return '0';
      }
      return prev.slice(0, -1);
    });
  }, [fresh]);

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

  const equals = useCallback(() => {
    // Plain arithmetic only — the secret check runs per keystroke in pushDigit.
    // The buffer is deliberately left alone so a code typed across '=' presses
    // still matches.
    if (op !== null && acc !== null) {
      const current = parseFloat(display) || 0;
      const result = compute(acc, current, op);
      setDisplay(formatResult(result));
      setAcc(null);
      setOp(null);
      setFresh(true);
    }
  }, [acc, display, op]);

  const clearAll = useCallback(() => {
    setDisplay('0');
    setAcc(null);
    setOp(null);
    setFresh(true);
    setBuffer('');
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
        { label: '⌫', kind: 'fn', onPress: backspace },
        { label: '%', kind: 'fn', onPress: percent },
        { label: '÷', kind: 'op', active: op === '÷', onPress: () => applyOp('÷') }
      ],
      [
        { label: '7', kind: 'num', onPress: () => pushDigit('7') },
        { label: '8', kind: 'num', onPress: () => pushDigit('8') },
        { label: '9', kind: 'num', onPress: () => pushDigit('9') },
        { label: '×', kind: 'op', active: op === '×', onPress: () => applyOp('×') }
      ],
      [
        { label: '4', kind: 'num', onPress: () => pushDigit('4') },
        { label: '5', kind: 'num', onPress: () => pushDigit('5') },
        { label: '6', kind: 'num', onPress: () => pushDigit('6') },
        { label: '−', kind: 'op', active: op === '-', onPress: () => applyOp('-') }
      ],
      [
        { label: '1', kind: 'num', onPress: () => pushDigit('1') },
        { label: '2', kind: 'num', onPress: () => pushDigit('2') },
        { label: '3', kind: 'num', onPress: () => pushDigit('3') },
        { label: '+', kind: 'op', active: op === '+', onPress: () => applyOp('+') }
      ],
      [
        { label: '0', kind: 'num', wide: true, onPress: () => pushDigit('0') },
        { label: '.', kind: 'num', onPress: dot },
        { label: '=', kind: 'op', onPress: equals }
      ]
    ],
    [applyOp, backspace, clearAll, dot, equals, op, percent, pushDigit]
  );

  return (
    <View
      style={[
        kp.root,
        { paddingTop: insets.top, paddingBottom: insets.bottom + 12 }
      ]}
    >
      <StatusBar barStyle="light-content" />
      <View style={kp.displayWrap}>
        <Text style={kp.display} numberOfLines={1} adjustsFontSizeToFit>
          {display}
        </Text>
      </View>
      <View style={kp.pad}>
        {rows.map((row, ri) => (
          <View style={[kp.row, { marginBottom: KEY_GAP }]} key={ri}>
            {row.map((k) => (
              <Key key={k.label} def={k} size={keySize} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

interface KeyDef {
  label: string;
  kind: 'num' | 'op' | 'fn';
  wide?: boolean;
  active?: boolean;
  onPress: () => void;
}

const KEY_COLORS: Record<
  KeyDef['kind'],
  { bg: string; bgPressed: string; text: string }
> = {
  num: { bg: '#333336', bgPressed: '#737377', text: '#fff' },
  fn: { bg: '#a5a5a5', bgPressed: '#d9d9d9', text: '#000' },
  op: { bg: '#ff9f0a', bgPressed: '#fcc78e', text: '#fff' }
};

function Key({ def, size }: { def: KeyDef; size: number }) {
  // All visual styles live on the inner View, not the Pressable: styles set
  // directly on Pressable were observed being dropped on-device (likely the
  // css-interop wrapper), which rendered the keypad as bare text.
  const [pressed, setPressed] = useState(false);
  const colors = KEY_COLORS[def.kind];
  // An op key stays visibly "armed" after selection, like a real calculator.
  const idleBg = def.active ? '#fff' : colors.bg;
  const idleText = def.active ? '#ff9f0a' : colors.text;
  return (
    <Pressable
      onPress={def.onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <View
        style={{
          width: def.wide ? size * 2 + KEY_GAP : size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: pressed ? colors.bgPressed : idleBg,
          alignItems: def.wide ? 'flex-start' : 'center',
          justifyContent: 'center',
          paddingLeft: def.wide ? size * 0.38 : 0
        }}
      >
        <Text
          style={{
            fontSize: size * 0.42,
            fontWeight: '500',
            color: idleText
          }}
        >
          {def.label}
        </Text>
      </View>
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
  const insets = useSafeAreaInsets();
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
    <View style={[nt.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <View style={nt.header}>
        <Text style={nt.title}>{title}</Text>
      </View>
      <KeyboardAvoidingView
        style={nt.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TextInput
          style={[nt.input, { paddingBottom: insets.bottom + 16 }]}
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
    </View>
  );
}

const kp = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  displayWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingHorizontal: 28,
    paddingBottom: 16
  },
  display: { color: '#fff', fontSize: 84, fontWeight: '300' },
  pad: {
    paddingHorizontal: PAD_H_PADDING,
    alignItems: 'center'
  },
  row: {
    flexDirection: 'row',
    gap: KEY_GAP
  }
});

const nt = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fdfdf7' },
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
