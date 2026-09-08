import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from "react-native";

import { useTextScale } from "../theme/useTheme";

/**
 * The app's only text component. It exists so the "размер интерфейса" setting can scale
 * every label from one place, without threading a multiplier through every screen.
 */
export function Text({ style, ...props }: TextProps) {
  const scale = useTextScale();
  if (scale === 1) return <RNText style={style} {...props} />;

  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const scaled: TextStyle = {
    fontSize: (flat.fontSize ?? 15) * scale,
    ...(flat.lineHeight ? { lineHeight: flat.lineHeight * scale } : {}),
  };
  return <RNText style={[style, scaled]} {...props} />;
}
