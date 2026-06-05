// Tare brand vocabulary: the balance-scale mark (weigh → tare → net) and the
// lowercase "tare" wordmark. Ported from the Tare design handoff (tare-app.jsx).
import { View, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { fonts } from '../constants';
import { useTheme } from '../theme';

/** The Tare app mark — a balance scale in a rounded copper square. */
export function TareMark({
  size = 64,
  radius,
  bg,
  fg = '#ffffff',
}: {
  size?: number;
  radius?: number;
  bg?: string;
  fg?: string;
}) {
  const { colors } = useTheme();
  const r = radius ?? size * 0.26;
  const glyph = size * 0.62;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        backgroundColor: bg ?? colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.28,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 5,
      }}
    >
      <Svg
        width={glyph}
        height={glyph}
        viewBox="0 0 100 100"
        fill="none"
        stroke={fg}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* beam */}
        <Path d="M30 40 H70" />
        {/* pans */}
        <Path d="M24 40 Q30 51 36 40" />
        <Path d="M64 40 Q70 51 76 40" />
        {/* center post */}
        <Path d="M50 40 V62" />
        {/* fulcrum */}
        <Path d="M40 66 L50 58 L60 66" />
        {/* ground line */}
        <Path d="M38 74 H62" strokeOpacity={0.55} />
      </Svg>
    </View>
  );
}

/** The "tare" wordmark (Archivo ExtraBold — closest to the design's Archivo
 * Expanded 800 without bundling a custom width-axis font). */
export function Wordmark({
  size = 34,
  color,
  tight = -1,
}: {
  size?: number;
  color?: string;
  tight?: number;
}) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        fontFamily: fonts.display,
        fontSize: size,
        letterSpacing: tight,
        color: color ?? colors.textPrimary,
        lineHeight: size * 1.02,
        includeFontPadding: false,
      }}
    >
      tare
    </Text>
  );
}
