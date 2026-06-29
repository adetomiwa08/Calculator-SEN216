import { useState, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  StatusBar, Dimensions, TextInput, Modal, FlatList,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const BTN = (width - 56) / 4;

function evaluate(expr, deg) {
  try {
    let e = expr
      .replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
      .replace(/π/g, `(${Math.PI})`).replace(/e(?![0-9])/g, `(${Math.E})`)
      .replace(/sin\(/g, deg ? `_sin(` : `Math.sin(`)
      .replace(/cos\(/g, deg ? `_cos(` : `Math.cos(`)
      .replace(/tan\(/g, deg ? `_tan(` : `Math.tan(`)
      .replace(/asin\(/g, deg ? `_asin(` : `Math.asin(`)
      .replace(/acos\(/g, deg ? `_acos(` : `Math.acos(`)
      .replace(/atan\(/g, deg ? `_atan(` : `Math.atan(`)
      .replace(/sinh\(/g, `Math.sinh(`)
      .replace(/cosh\(/g, `Math.cosh(`)
      .replace(/tanh\(/g, `Math.tanh(`)
      .replace(/log\(/g, `Math.log10(`)
      .replace(/ln\(/g, `Math.log(`)
      .replace(/sqrt\(/g, `Math.sqrt(`)
      .replace(/abs\(/g, `Math.abs(`);

    const R = Math.PI / 180;
    const _sin  = x => Math.sin(x * R);
    const _cos  = x => Math.cos(x * R);
    const _tan  = x => Math.tan(x * R);
    const _asin = x => Math.asin(x) / R;
    const _acos = x => Math.acos(x) / R;
    const _atan = x => Math.atan(x) / R;

    let open = 0;
    for (const c of e) { if (c === '(') open++; if (c === ')') open--; }
    e += ')'.repeat(Math.max(0, open));

    const result = new Function(
      '_sin','_cos','_tan','_asin','_acos','_atan',
      `"use strict"; return (${e})`
    )(_sin, _cos, _tan, _asin, _acos, _atan);

    if (!isFinite(result)) return '';
    return String(parseFloat(result.toPrecision(10)));
  } catch { return ''; }
}

function factorial(n) {
  if (n < 0 || n > 170 || n !== Math.floor(n)) return 'Error';
  let r = 1; for (let i = 2; i <= n; i++) r *= i; return String(r);
}

const BUTTONS = [
  [
    { label: 'AC',  type: 'clear'  },
    { label: 'DEL', type: 'del'    },
    { label: '%',   type: 'action' },
    { label: '÷',   type: 'op'     },
  ],
  [
    { label: '7', type: 'num' }, { label: '8', type: 'num' },
    { label: '9', type: 'num' }, { label: '×', type: 'op'  },
  ],
  [
    { label: '4', type: 'num' }, { label: '5', type: 'num' },
    { label: '6', type: 'num' }, { label: '−', type: 'op'  },
  ],
  [
    { label: '1', type: 'num' }, { label: '2', type: 'num' },
    { label: '3', type: 'num' }, { label: '+', type: 'op'  },
  ],
  [
    { label: '0', type: 'num', wide: true },
    { label: '.', type: 'num' },
    { label: '=', type: 'equals' },
  ],
];

const SCI_ROWS = [
  ['sin(', 'cos(', 'tan(',  'π'   ],
  ['asin(','acos(','atan(', 'e'   ],
  ['sinh(','cosh(','tanh(', '^'   ],
  ['log(', 'ln(',  'sqrt(', 'abs('],
  ['(',    ')',    '+/-',   'x!'  ],
];

const C = {
  bg:          '#060608',
  glassBorder: 'rgba(255,255,255,0.12)',
  neon:        '#00ffc8',
  neonDim:     'rgba(0,255,200,0.15)',
  purple:      '#c4b5fd',
  num:         'rgba(255,255,255,0.08)',
  numBorder:   'rgba(255,255,255,0.10)',
  white:       '#ffffff',
  gray:        '#9999aa',
};

// ── Ripple Button ────────────────────────────────────────────────────────────
function RippleButton({ onPress, style, children, rippleColor = 'rgba(0,255,200,0.35)' }) {
  const scale   = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const triggerRipple = () => {
    scale.setValue(0);
    opacity.setValue(1);
    Animated.parallel([
      Animated.timing(scale,   { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={triggerRipple}
      activeOpacity={0.75}
      style={[style, { overflow: 'hidden' }]}>
      {/* Liquid ripple layer */}
      <Animated.View
        style={{
          position: 'absolute',
          width: '200%',
          aspectRatio: 1,
          top: '-50%',
          left: '-50%',
          borderRadius: 9999,
          backgroundColor: rippleColor,
          transform: [{ scale }],
          opacity,
        }}
      />
      {children}
    </TouchableOpacity>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [expr,        setExpr]        = useState('');
  const [sciMode,     setSciMode]     = useState(false);
  const [degMode,     setDegMode]     = useState(true);
  const [justEvaled,  setJustEvaled]  = useState(false);
  const [history,     setHistory]     = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const liveResult = expr.length > 1 ? evaluate(expr, degMode) : '';
  const showLive   = liveResult !== '' && liveResult !== expr;

  const addHistory = useCallback((expression, result) => {
    setHistory(prev => {
      const entry = { id: Date.now().toString(), expr: expression, result };
      return [entry, ...prev].slice(0, 10);
    });
  }, []);

  const insertVal = useCallback((val) => {
    setJustEvaled(false);
    setExpr(prev => {
      if (justEvaled && /^[0-9.]$/.test(val)) return val;
      return prev + val;
    });
  }, [justEvaled]);

  const handleButton = useCallback((label) => {
    switch (label) {
      case 'AC':
        setExpr(''); setJustEvaled(false); break;

      case 'DEL':
        if (!justEvaled) setExpr(prev => prev.slice(0, -1));
        break;

      case '+/-':
        if (!justEvaled)
          setExpr(prev => prev.startsWith('-') ? prev.slice(1) : '-' + prev);
        break;

      case 'x!': {
        const result = factorial(parseFloat(expr));
        if (result !== 'Error') addHistory(expr + '!', result);
        setExpr(result); setJustEvaled(true); break;
      }

      case '=': {
        const result = evaluate(expr, degMode);
        if (result !== '') {
          addHistory(expr, result);
          setExpr(result);
          setJustEvaled(true);
        }
        break;
      }

      default: insertVal(label);
    }
  }, [expr, degMode, justEvaled, insertVal, addHistory]);

  const exprFontSize = expr.length > 18 ? 20 : expr.length > 12 ? 28 : 38;
  const liveFontSize = liveResult.length > 14 ? 18 : 24;

  const getRippleColor = (type) => {
    if (type === 'op')     return 'rgba(0,255,200,0.4)';
    if (type === 'equals') return 'rgba(0,255,200,0.55)';
    if (type === 'clear')  return 'rgba(255,80,80,0.4)';
    if (type === 'del')    return 'rgba(255,160,50,0.4)';
    return 'rgba(255,255,255,0.15)';
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Header ── */}
      <View style={s.header}>
        <RippleButton
          style={[s.pill, sciMode && s.pillActive]}
          onPress={() => setSciMode(p => !p)}
          rippleColor="rgba(0,255,200,0.3)">
          <Text style={[s.pillText, sciMode && s.pillTextActive]}>SCI</Text>
        </RippleButton>

        <TouchableOpacity style={s.historyBtn} onPress={() => setShowHistory(true)}>
          <Text style={s.title}>CALCULATOR</Text>
          <Text style={s.historyHint}>⏱ history</Text>
        </TouchableOpacity>

        <RippleButton
          style={[s.pill, !degMode && s.pillActive]}
          onPress={() => setDegMode(p => !p)}
          rippleColor="rgba(0,255,200,0.3)">
          <Text style={[s.pillText, !degMode && s.pillTextActive]}>
            {degMode ? 'DEG' : 'RAD'}
          </Text>
        </RippleButton>
      </View>

      {/* ── Display ── */}
      <View style={s.displayWrap}>
        <TextInput
          style={[s.exprInput, { fontSize: exprFontSize }]}
          value={expr}
          onChangeText={text => { setJustEvaled(false); setExpr(text); }}
          placeholder="0"
          placeholderTextColor="rgba(255,255,255,0.2)"
          selectionColor={C.neon}
          showSoftInputOnFocus={false}
          multiline={false}
        />
        {showLive && (
          <Text style={[s.liveResult, { fontSize: liveFontSize }]}>
            = {liveResult}
          </Text>
        )}
      </View>

      {/* ── Scientific panel ── */}
      {sciMode && (
        <View style={s.sciWrap}>
          {SCI_ROWS.map((row, ri) => (
            <View key={ri} style={s.sciRow}>
              {row.map(lbl => (
                <RippleButton
                  key={lbl}
                  style={s.sciBtn}
                  onPress={() => handleButton(lbl)}
                  rippleColor="rgba(167,139,250,0.35)">
                  <Text style={s.sciBtnText}>{lbl}</Text>
                </RippleButton>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* ── Button grid ── */}
      <View style={s.btnGrid}>
        {BUTTONS.map((row, ri) => (
          <View key={ri} style={s.row}>
            {row.map(btn => {
              const isWide   = btn.wide;
              const isEquals = btn.type === 'equals';
              const isOp     = btn.type === 'op';
              const isClear  = btn.type === 'clear';
              const isDel    = btn.type === 'del';
              return (
                <RippleButton
                  key={btn.label}
                  onPress={() => handleButton(btn.label)}
                  rippleColor={getRippleColor(btn.type)}
                  style={[
                    s.btn,
                    isWide   && s.btnWide,
                    isEquals && s.btnEquals,
                    isOp     && s.btnOp,
                    isClear  && s.btnClear,
                    isDel    && s.btnDel,
                  ]}>
                  <Text style={[
                    s.btnLabel,
                    isOp     && s.btnLabelOp,
                    isEquals && s.btnLabelEquals,
                    isClear  && s.btnLabelClear,
                    isDel    && s.btnLabelDel,
                  ]}>
                    {btn.label}
                  </Text>
                </RippleButton>
              );
            })}
          </View>
        ))}
      </View>

      {/* ── History Modal ── */}
      <Modal
        visible={showHistory}
        animationType="slide"
        transparent
        onRequestClose={() => setShowHistory(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>History</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {history.length === 0 ? (
              <Text style={s.emptyHistory}>No calculations yet</Text>
            ) : (
              <FlatList
                data={history}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={s.historyItem}
                    onPress={() => {
                      setExpr(item.result);
                      setJustEvaled(true);
                      setShowHistory(false);
                    }}>
                    <Text style={s.historyExpr}>{item.expr}</Text>
                    <Text style={s.historyResult}>= {item.result}</Text>
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={s.separator} />}
              />
            )}

            {history.length > 0 && (
              <TouchableOpacity
                style={s.clearHistory}
                onPress={() => setHistory([])}>
                <Text style={s.clearHistoryText}>Clear History</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
  },
  title: {
    color: C.white, fontSize: 14, fontWeight: '700',
    letterSpacing: 6, opacity: 0.5, textAlign: 'center',
  },
  historyBtn:  { alignItems: 'center' },
  historyHint: {
    color: C.neon, fontSize: 9, fontWeight: '700',
    letterSpacing: 2, opacity: 0.7, marginTop: 2,
  },
  pill: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: C.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  pillActive:     { borderColor: C.neon, backgroundColor: C.neonDim },
  pillText:       { color: C.gray, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  pillTextActive: { color: C.neon },

  displayWrap: {
    marginHorizontal: 12, marginTop: 4, borderRadius: 20,
    borderWidth: 1, borderColor: C.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 20, paddingVertical: 16,
    minHeight: 120, justifyContent: 'flex-end',
  },
  exprInput: {
    color: C.white, fontWeight: '300', textAlign: 'right',
    padding: 0, letterSpacing: -0.5,
  },
  liveResult: {
    color: C.neon, fontWeight: '400',
    textAlign: 'right', marginTop: 8, opacity: 0.85,
  },

  sciWrap: {
    marginHorizontal: 12, marginTop: 8,
    borderRadius: 14, borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
  },
  sciRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  sciBtn: {
    flex: 1, paddingVertical: 9, alignItems: 'center',
    borderRightWidth: 0.5,
    borderRightColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  sciBtnText: { color: C.purple, fontSize: 13, fontWeight: '700' },

  btnGrid: {
    paddingHorizontal: 12, paddingBottom: 6,
    marginTop: 'auto',
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 8,
  },

  btn: {
    width: BTN, height: BTN, borderRadius: BTN / 2,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.numBorder, backgroundColor: C.num,
  },
  btnWide:   { width: BTN * 2 + 16 },
  btnOp:     { borderColor: 'rgba(0,255,200,0.30)', backgroundColor: 'rgba(0,255,200,0.07)' },
  btnClear:  { borderColor: 'rgba(255,80,80,0.35)',  backgroundColor: 'rgba(255,80,80,0.08)'  },
  btnDel:    { borderColor: 'rgba(255,160,50,0.35)', backgroundColor: 'rgba(255,160,50,0.08)' },
  btnEquals: {
    borderColor: C.neon, backgroundColor: 'rgba(0,255,200,0.18)',
    shadowColor: C.neon, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 14, elevation: 12,
  },

  btnLabel:       { color: C.white,   fontSize: 20, fontWeight: '500' },
  btnLabelOp:     { color: C.neon,    fontSize: 22, fontWeight: '500' },
  btnLabelEquals: {
    color: C.neon, fontSize: 26, fontWeight: '500',
    textShadowColor: C.neon, textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  btnLabelClear:  { color: '#ff5050', fontSize: 15, fontWeight: '700' },
  btnLabelDel:    { color: '#ffaa33', fontSize: 13, fontWeight: '700' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#0f0f12', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, borderWidth: 1,
    borderColor: C.glassBorder, maxHeight: '70%', paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 20,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle:       { color: C.white, fontSize: 18, fontWeight: '700' },
  modalClose:       { color: C.gray,  fontSize: 18, fontWeight: '700' },
  emptyHistory:     {
    color: C.gray, textAlign: 'center',
    marginTop: 40, fontSize: 15,
  },
  historyItem:      { paddingHorizontal: 20, paddingVertical: 14 },
  historyExpr:      { color: C.gray,  fontSize: 14, fontWeight: '400', marginBottom: 4 },
  historyResult:    { color: C.white, fontSize: 20, fontWeight: '300' },
  separator:        { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 20 },
  clearHistory: {
    marginHorizontal: 20, marginTop: 16, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,80,80,0.3)', alignItems: 'center',
  },
  clearHistoryText: { color: '#ff5050', fontSize: 14, fontWeight: '700' },
});