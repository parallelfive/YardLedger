import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
} from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  type Palette,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../constants';
import { useTheme, useThemedStyles } from '../theme';

// Must match the native SignaturePad.tsx handle so importers typecheck on both
// platforms.
export interface SignaturePadHandle {
  readSignature: () => Promise<string | null>;
  clear: () => void;
}

interface SignaturePadProps {
  onSignatureChange?: (signature: string | null) => void;
  label?: string;
  clearLabel?: string;
}

const PAD_HEIGHT = 140;

// Real web signature pad. Native uses react-native-signature-canvas (a WebView
// pad that can't load in a browser); here we draw directly on an HTML <canvas>
// with pointer events. react-native-web renders through react-dom, so a raw
// <canvas> element is valid in this .web build. readSignature() returns a PNG
// data URL — the same shape the native pad produces — so the buy flow stores a
// genuine signature image, not a placeholder.
const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  (
    { onSignatureChange, label = 'Customer Signature', clearLabel = 'Clear' },
    ref
  ) => {
    const { colors } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawing = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);
    // Synchronous ink flag: state updates are async, so endStroke can't trust
    // the hasInk state from its closure on the first stroke. The ref is the
    // source of truth for "has anything been drawn"; hasInk only drives UI.
    const inked = useRef(false);
    const [hasInk, setHasInk] = useState(false);

    // Size the backing store to the element's CSS box × DPR so strokes are
    // crisp and coordinates map 1:1. Called on the canvas ref callback.
    const setupCanvas = useCallback(
      (canvas: HTMLCanvasElement | null) => {
        canvasRef.current = canvas;
        if (!canvas) return;
        const dpr = globalThis.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const width = rect.width || canvas.clientWidth || 300;
        canvas.width = width * dpr;
        canvas.height = PAD_HEIGHT * dpr;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = colors.textPrimary;
        }
      },
      [colors.textPrimary]
    );

    const pointFromEvent = (e: PointerEvent | React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      canvasRef.current?.setPointerCapture?.(e.pointerId);
      drawing.current = true;
      last.current = pointFromEvent(e);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current) return;
      const ctx = canvasRef.current?.getContext('2d');
      const prev = last.current;
      if (!ctx || !prev) return;
      const next = pointFromEvent(e);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
      last.current = next;
      inked.current = true;
      if (!hasInk) setHasInk(true);
    };

    const endStroke = () => {
      if (!drawing.current) return;
      drawing.current = false;
      last.current = null;
      const canvas = canvasRef.current;
      if (canvas && inked.current) {
        onSignatureChange?.(canvas.toDataURL('image/png'));
      }
    };

    const clear = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      inked.current = false;
      setHasInk(false);
      onSignatureChange?.(null);
    }, [onSignatureChange]);

    useImperativeHandle(
      ref,
      () => ({
        readSignature: async () =>
          inked.current && canvasRef.current
            ? canvasRef.current.toDataURL('image/png')
            : null,
        clear,
      }),
      [clear]
    );

    return (
      <View style={styles.wrap}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {hasInk ? (
            <TouchableOpacity onPress={clear}>
              <Text style={styles.clear}>{clearLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.padFrame}>
          <canvas
            ref={setupCanvas}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerLeave={endStroke}
            style={{
              width: '100%',
              height: PAD_HEIGHT,
              touchAction: 'none',
              cursor: 'crosshair',
              display: 'block',
            }}
          />
          {!hasInk ? (
            <View style={styles.hintOverlay} pointerEvents="none">
              <Text style={styles.hintText}>Sign here</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }
);

SignaturePad.displayName = 'SignaturePad';
export default SignaturePad;

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: { gap: spacing.sm },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    label: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontFamily: fonts.sansSemiBold,
    },
    padFrame: {
      height: PAD_HEIGHT,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    hintOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hintText: {
      color: colors.textTertiary,
      fontSize: fontSize.md,
      fontFamily: fonts.sans,
    },
    clear: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontFamily: fonts.sansSemiBold,
    },
  });
