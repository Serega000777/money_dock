import { useId } from "react";
import { Platform } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";

/**
 * The Amola Finance wordmark, drawn from the brand PNG's own geometry rather than typed
 * in a font: every letter of "amola" is a round-capped stroke — rings for the bowls, bars
 * for the stems, two arches for the m — so it renders identically on every platform and
 * scales without blurring. Proportions measured off the reference: stroke ≈ 0.26 of the
 * x-height, the l's ascender ≈ 1.39 of it, gaps ≈ 0.1.
 */
const STROKE = 26;
const RING_R = 37; // centreline radius: (100 - STROKE) / 2 for a 100-unit x-height
const CY = 90; // ring centre: x-height spans y 40..140
const STEM_TOP = 53; // 40 + STROKE / 2
const BASE = 127; // 140 - STROKE / 2
const ARCH_R = 28.5;
const ARCH_CY = STEM_TOP + ARCH_R;

const LOGO_GRADIENT = ["#FF1FAE", "#F94CDC", "#E668FF"] as const;

export function AmolaLogo({
  width = 150,
  /** "finance" is light on dark grounds (onboarding, dark theme) and plum on light. */
  subColor = "#E8D6F5",
}: {
  width?: number;
  subColor?: string;
}) {
  const id = `amola${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const height = (width * 210) / 522;

  return (
    <Svg width={width} height={height} viewBox="-8 -8 522 210">
      <Defs>
        {/* userSpaceOnUse, not the default objectBoundingBox: a straight stem has a
            zero-width bbox, and an objectBoundingBox gradient on it renders nothing at
            all. One user-space sweep across the whole word is also how the mark itself
            is coloured — the gradient runs a → a, not per letter. */}
        <LinearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="506" y2="0">
          {LOGO_GRADIENT.map((color, i) => (
            <Stop key={color} offset={i / (LOGO_GRADIENT.length - 1)} stopColor={color} />
          ))}
        </LinearGradient>
      </Defs>

      <G stroke={`url(#${id})`} strokeWidth={STROKE} strokeLinecap="round" fill="none">
        {/* a */}
        <Circle cx={50} cy={CY} r={RING_R} />
        <Path d={`M87 ${STEM_TOP}V${BASE}`} />
        {/* m */}
        <Path
          d={`M126 ${BASE}V${ARCH_CY}A${ARCH_R} ${ARCH_R} 0 0 1 183 ${ARCH_CY}V${BASE}M183 ${ARCH_CY}A${ARCH_R} ${ARCH_R} 0 0 1 240 ${ARCH_CY}V${BASE}`}
        />
        {/* o */}
        <Circle cx={313} cy={CY} r={RING_R} />
        {/* l */}
        <Path d={`M383 14V${BASE}`} />
        {/* a */}
        <Circle cx={456} cy={CY} r={RING_R} />
        <Path d={`M493 ${STEM_TOP}V${BASE}`} />
      </G>

      <SvgText
        x={253}
        y={190}
        textAnchor="middle"
        fontSize={28}
        fontWeight="600"
        letterSpacing={19}
        fill={subColor}
        fontFamily={SUB_FONT}
      >
        finance
      </SvgText>
    </Svg>
  );
}

const SUB_FONT = Platform.select({
  web: '"Nunito", "Quicksand", "Varela Round", "Segoe UI", system-ui, sans-serif',
  default: undefined,
});
