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
 * Realistic-enough bank card art — brand colour, a simplified mark evoking each bank's
 * real logo, and a wordmark, not the real logos pixel-for-pixel (same call as the
 * onboarding's Yandex/VK lettermarks: there is no actual bank integration behind this,
 * only account colour-coding, so shipping the exact marks would promise more than
 * exists). One design per `Bank`; `AccountTile` picks the variant from `account.bank`,
 * `BankPicker` renders the same art to choose from.
 */
const BANK_STYLE: Record<
  Bank,
  {
    colors: readonly [string, string, string];
    glow: string;
    /** A second edge-glow colour — several real cards' outline visibly shifts hue along
     * its length (Sber green→violet, VTB/Ozon blue→magenta) rather than staying one
     * colour; omit for a single-tone edge. */
    edgeTo?: string;
    label: string;
    labelColor: string;
    chip: string;
    mark: Bank;
  }
> = {
  sber: {
    colors: ["#081426", "#063D32", "#10D95A"],
    glow: "#8B3AFF",
    edgeTo: "#43FF70",
    label: "СБЕР",
    labelColor: "#FFFFFF",
    chip: "#DDFBE3",
    mark: "sber",
  },
  alfa: {
    colors: ["#28070A", "#76080D", "#F31D2F"],
    glow: "#FF3145",
    label: "Альфа-Банк",
    labelColor: "#FFFFFF",
    chip: "#FFE1E4",
    mark: "alfa",
  },
  tinkoff: {
    colors: ["#171307", "#6F5700", "#FFDD2D"],
    glow: "#FFE75E",
    label: "Т-Банк",
    labelColor: "#FFFFFF",
    chip: "#FFF4A8",
    mark: "tinkoff",
  },
  vtb: {
    colors: ["#050E39", "#063F9D", "#087DFF"],
    glow: "#38CCFF",
    edgeTo: "#FF3AD6",
    label: "ВТБ",
    labelColor: "#FFFFFF",
    chip: "#D7E9FF",
    mark: "vtb",
  },
  ozon: {
    colors: ["#07104A", "#073CE0", "#2C6BFF"],
    glow: "#38CCFF",
    edgeTo: "#FF3AD6",
    label: "Ozon Банк",
    labelColor: "#FFFFFF",
    chip: "#E2E7FF",
    mark: "ozon",
  },
  bank_russia: {
    colors: ["#020818", "#062449", "#0A4A96"],
    glow: "#3FA9FF",
    label: "Банк России",
    labelColor: "#EAF4FF",
    chip: "#D7E9FF",
    mark: "bank_russia",
  },
  gazprombank: {
    colors: ["#020818", "#063547", "#0B7A96"],
    glow: "#3FE0FF",
    label: "Газпромбанк",
    labelColor: "#EAFBFF",
    chip: "#D7F7FF",
    mark: "gazprombank",
  },
};

const W = 300;
const H = 176;

/** The big, semi-transparent institutional mark bleeding off the bottom-right corner —
 * every reference card has one. Simplified silhouettes, not the real logos (see the
 * comment above BANK_STYLE). */
function BankWatermark({ bank, color }: { bank: Bank; color: string }) {
  const s = { fill: "none", stroke: color, strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, opacity: 0.5 };
  switch (bank) {
    case "sber":
      return <Path d="M222 118l14 16 34-42" {...s} strokeWidth={9} />;
    case "alfa":
      return (
        <Path
          d="M246 78l34 68h-16l-6-13h-24l-6 13h-16zm0 20-8 17h16z"
          fill={color}
          opacity={0.5}
        />
      );
    case "vtb":
      return (
        <>
          <Path d="M214 84l70-14" {...s} strokeWidth={7} />
          <Path d="M210 108l70-14" {...s} strokeWidth={7} />
          <Path d="M206 132l70-14" {...s} strokeWidth={7} />
        </>
      );
    case "ozon":
      return null;
    case "bank_russia":
      return (
        <>
          <Path d="M252 70a26 26 0 1 0 0 52 26 26 0 1 0 0-52Z" {...s} strokeWidth={3.5} />
          <Path d="M252 84v24M240 96h24" {...s} strokeWidth={3.5} />
          <Path d="M226 150c6-16 14-22 26-22s20 6 26 22" {...s} strokeWidth={3.5} />
        </>
      );
    case "gazprombank":
      return (
        <>
          <Path d="M254 96a20 20 0 1 1-20 20" {...s} strokeWidth={5} />
          <Path d="M254 106a10 10 0 1 1-10 10" {...s} strokeWidth={5} />
        </>
      );
    case "tinkoff":
    default:
      return <Path d="M220 82h58M249 82v56" {...s} strokeWidth={9} />;
  }
}

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
  const edgeId = `${id}edge`;

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
          {style.edgeTo ? (
            <LinearGradient id={edgeId} x1="0" y1="1" x2="1" y2="0">
              <Stop offset="0" stopColor={style.glow} />
              <Stop offset="1" stopColor={style.edgeTo} />
            </LinearGradient>
          ) : null}
        </Defs>
        <Rect x="0" y="0" width={W} height={H} rx="18" fill={`url(#${id})`} />
        <Rect x="0" y="0" width={W} height={H} rx="18" fill={`url(#${glowId})`} />
        <BankWatermark bank={bank} color={style.glow} />
        <Rect
          x="1.5"
          y="1.5"
          width={W - 3}
          height={H - 3}
          rx="17"
          fill="none"
          stroke={style.edgeTo ? `url(#${edgeId})` : style.glow}
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
              {last4 ? `•••• ${last4}` : "•••• ••••"}
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
  bank_russia: "Банк России",
  gazprombank: "Газпромбанк",
};

export const BANK_ORDER: Bank[] = [
  "sber",
  "alfa",
  "tinkoff",
  "vtb",
  "ozon",
  "bank_russia",
  "gazprombank",
];
