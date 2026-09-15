import type { Bank } from "@money-dock/shared-types";
import { useId } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

/**
 * Realistic-enough bank card art — brand colour and wordmark, not the real logos (same
 * call as the onboarding's Yandex/VK lettermarks: there is no actual bank integration
 * behind this, only account colour-coding, so shipping the real marks would promise more
 * than exists). One design per `Bank`; `AccountTile` picks the variant from
 * `account.bank`, `BankPicker` renders the same art to choose from.
 */
const BANK_STYLE: Record<
  Bank,
  {
    colors: readonly [string, string, string];
    glow: string;
    label: string;
    labelColor: string;
    chip: string;
  }
> = {
  sber: {
    colors: ["#081426", "#063D32", "#10D95A"],
    glow: "#43FF70",
    label: "СБЕР",
    labelColor: "#FFFFFF",
    chip: "#DDFBE3",
  },
  alfa: {
    colors: ["#28070A", "#76080D", "#F31D2F"],
    glow: "#FF3145",
    label: "Альфа-Банк",
    labelColor: "#FFFFFF",
    chip: "#FFE1E4",
  },
  tinkoff: {
    colors: ["#171307", "#6F5700", "#FFDD2D"],
    glow: "#FFE75E",
    label: "Т-Банк",
    labelColor: "#FFFFFF",
    chip: "#FFF4A8",
  },
  vtb: {
    colors: ["#050E39", "#063F9D", "#087DFF"],
    glow: "#38CCFF",
    label: "ВТБ",
    labelColor: "#FFFFFF",
    chip: "#D7E9FF",
  },
  ozon: {
    colors: ["#07104A", "#073CE0", "#7A26FF"],
    glow: "#35E8FF",
    label: "OZON Банк",
    labelColor: "#FFFFFF",
    chip: "#E2E7FF",
  },
};

const W = 300;
const H = 176;

export function BankCardArt({
  bank,
  last4,
  compact,
  fillStyle,
}: {
  bank: Bank;
  last4?: string | null;
  /** The home screen tile — smaller type, no last-4 line (the tile shows the balance
   * there instead). */
  compact?: boolean;
  /** Overrides the default edge-to-edge fill — needed when the parent has its own
   * padding (the art has to reach past it to the tile's real corners, e.g. `{ top: -14,
   * right: -14, bottom: -14, left: -14 }` for 14px padding). */
  fillStyle?: StyleProp<ViewStyle>;
}) {
  const style = BANK_STYLE[bank];
  const id = `bank${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const glowId = `${id}glow`;

  return (
    <View style={[StyleSheet.absoluteFill, fillStyle]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={style.colors[0]} />
            <Stop offset="0.62" stopColor={style.colors[1]} />
            <Stop offset="1" stopColor={style.colors[2]} />
          </LinearGradient>
          <RadialGradient id={glowId} cx="82%" cy="12%" rx="68%" ry="95%">
            <Stop offset="0" stopColor={style.glow} stopOpacity="0.62" />
            <Stop offset="1" stopColor={style.glow} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={W} height={H} rx="18" fill={`url(#${id})`} />
        <Rect x="0" y="0" width={W} height={H} rx="18" fill={`url(#${glowId})`} />
        <Path
          d="M176 -8C150 50 139 108 126 184M226 -8C195 51 184 117 167 184M278 -8C242 55 224 122 207 184"
          stroke={style.glow}
          strokeWidth={compact ? 1.2 : 1.8}
          fill="none"
          opacity={0.7}
        />
        <Rect
          x="1.5"
          y="1.5"
          width={W - 3}
          height={H - 3}
          rx="17"
          fill="none"
          stroke={style.glow}
          strokeWidth="3"
          opacity="0.95"
        />

        {compact ? (
          // AccountTile already draws its own icon (top-left) and balance (bottom-left)
          // over this art, so the wordmark sits alone in the one corner nothing else
          // uses — bottom-right — small enough not to compete with either.
          <SvgText
            x={W - 13}
            y={H - 14}
            textAnchor="end"
            fontSize={15}
            fontWeight="800"
            letterSpacing={bank === "tinkoff" ? 0.4 : 0.2}
            fill={style.labelColor}
            opacity={0.9}
          >
            {style.label}
          </SvgText>
        ) : (
          <>
            <Rect x="24" y="28" width="34" height="24" rx="5" fill={style.chip} opacity={0.9} />
            <Path d="M24 40H58M41 28V52" stroke={style.colors[1]} strokeWidth="1" opacity={0.5} />
            <Path
              d="M70 34c5 5 5 13 0 18M76 30c8 8 8 20 0 28"
              stroke={style.labelColor}
              strokeWidth="2.4"
              strokeLinecap="round"
              fill="none"
              opacity={0.85}
            />
            <SvgText
              x="24"
              y={H - 60}
              fontSize={24}
              fontWeight="800"
              letterSpacing={bank === "tinkoff" ? 0.5 : 0.3}
              fill={style.labelColor}
            >
              {style.label}
            </SvgText>
            <SvgText
              x="24"
              y={H - 26}
              fontSize={17}
              fontWeight="600"
              letterSpacing={3}
              fill={style.labelColor}
              opacity={0.85}
            >
              {`•••• ${last4 ?? "0000"}`}
            </SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}

export const BANK_LABEL: Record<Bank, string> = {
  sber: "СБЕР",
  alfa: "Альфа-Банк",
  tinkoff: "Т-Банк",
  vtb: "ВТБ",
  ozon: "OZON",
};

export const BANK_ORDER: Bank[] = ["sber", "alfa", "tinkoff", "vtb", "ozon"];
