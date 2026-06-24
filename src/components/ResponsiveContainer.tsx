import type { ReactNode } from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useResponsive, contentMaxWidth } from '../hooks/useResponsive';

interface ResponsiveContainerProps {
  children: ReactNode;
  /** Override the max content width. Defaults to `contentMaxWidth` (640). */
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
}

// Centers a content column and caps its width on tablet/desktop so forms and
// reading flows don't stretch edge-to-edge in a browser. On phones it's a
// transparent passthrough (full width). Use as the inner wrapper of a
// ScrollView's contentContainer, or around a screen body.
export default function ResponsiveContainer({
  children,
  maxWidth = contentMaxWidth,
  style,
}: ResponsiveContainerProps) {
  const { isWide } = useResponsive();
  return (
    <View
      style={[styles.base, isWide && { maxWidth, alignSelf: 'center' }, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
  },
});
