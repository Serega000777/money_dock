import type { Bank } from "@money-dock/shared-types";
import { useId } from "react";
import {
  Image,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
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

/**
 * The supplied artwork is intentionally used verbatim.  It includes a little scene
 * around the physical card, so each frame below maps the card rectangle in the source
 * image to this component's bounds.  Keeping the original files (rather than tracing
 * their logos and light effects in SVG) is what makes the home tile and picker match
 * the references pixel-for-pixel.
 */
const REFERENCE_ART: Partial<Record<Bank, { file: string; frame: ImageStyle }>> = {
  bank_russia: {
    file: "bank-russia.png",
    frame: { left: "-14.0%", top: "-24.4%", width: "127.9%", height: "153.2%" },
  },
  gazprombank: {
    file: "gazprombank.png",
    frame: { left: "-14.2%", top: "-28.5%", width: "128.4%", height: "162.1%" },
  },
  ozon: {
    file: "ozon.png",
    frame: { left: "-15.6%", top: "-27.3%", width: "131.4%", height: "161.1%" },
  },
  vtb: {
    file: "vtb.png",
    frame: { left: "-16.3%", top: "-30.0%", width: "132.8%", height: "164.6%" },
  },
  alfa: {
    file: "alfa.png",
    frame: { left: "-17.4%", top: "-28.6%", width: "135.5%", height: "164.6%" },
  },
  sber: {
    file: "sber.png",
    frame: { left: "-18.7%", top: "-30.9%", width: "137.3%", height: "167.1%" },
  },
};

/** The big, semi-transparent institutional mark bleeding off the bottom-right corner —
 * every reference card has one. Simplified silhouettes, not the real logos (see the
 * comment above BANK_STYLE). */
function BankWatermark({ bank, color }: { bank: Bank; color: string }) {
  const s = {
    fill: "none",
    stroke: color,
    strokeWidth: 3,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    opacity: 0.5,
  };
  switch (bank) {
    case "sber":
      return <Path d="M222 118l14 16 34-42" {...s} strokeWidth={9} />;
    case "alfa":
      return (
        <Path d="M246 78l34 68h-16l-6-13h-24l-6 13h-16zm0 20-8 17h16z" fill={color} opacity={0.5} />
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

function BankMark({ bank, color }: { bank: Bank; color: string }) {
  switch (bank) {
    case "sber":
      return (
        <G>
          <Circle cx="42" cy="35" r="15" fill="none" stroke={color} strokeWidth="4" />
          <Path
            d="M31 35l9 8 16-17"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
          />
        </G>
      );
    case "alfa":
      return (
        <G>
          <Path d="M27 50l15-34 15 34h-9l-3-8h-8l-3 8zm13-16h3l-2-6z" fill={color} />
          <Rect x="27" y="54" width="30" height="4" fill={color} />
        </G>
      );
    case "vtb":
      return (
        <G fill={color}>
          <Path d="M25 22h35l-5 7H23z" />
          <Path d="M22 33h31l-5 7H20z" />
          <Path d="M19 44h27l-5 7H17z" />
        </G>
      );
    case "tinkoff":
      return (
        <G>
          <Path
            d="M25 18h34v24c0 10-7 15-17 19-10-4-17-9-17-19z"
            fill="none"
            stroke={color}
            strokeWidth="3"
          />
          <SvgText x="42" y="48" textAnchor="middle" fontSize="22" fontWeight="900" fill={color}>
            T
          </SvgText>
        </G>
      );
    case "bank_russia":
      return (
        <G>
          <Circle cx="42" cy="36" r="18" fill="none" stroke={color} strokeWidth="3" />
          <Path
            d="M31 42l11-16 11 16M35 35h14M42 26v22"
            fill="none"
            stroke={color}
            strokeWidth="2"
          />
        </G>
      );
    case "gazprombank":
      return (
        <G>
          <Circle cx="42" cy="36" r="18" fill="none" stroke={color} strokeWidth="3" />
          <Path
            d="M30 32c12-8 24-5 27 4M28 39c13-7 24-3 27 3M31 46c10-4 17-2 21 1"
            fill="none"
            stroke={color}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </G>
      );
    case "ozon":
    default:
      return null;
  }
}

function CardPattern({ bank, color }: { bank: Bank; color: string }) {
  if (bank === "alfa") {
    return (
      <G fill="none" stroke={color} opacity={0.55}>
        <Path d="M208 -10L112 186" strokeWidth="18" />
        <Path d="M264 -10L168 186" strokeWidth="18" />
        <Path d="M320 -10L224 186" strokeWidth="18" />
      </G>
    );
  }
  return (
    <G fill="none" stroke={color} opacity={0.68}>
      <Path d="M306 8C223 24 194 74 145 184" strokeWidth="2" />
      <Path d="M310 58C245 68 217 110 181 184" strokeWidth="2" />
      <Path d="M312 111C268 119 240 145 216 184" strokeWidth="2" />
    </G>
  );
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
  const reference = REFERENCE_ART[bank];
  if (reference) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.referenceViewport, fillStyle]}>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="stretch"
          source={{ uri: `/bank-cards/${reference.file}?v=20260928` }}
          style={[styles.referenceImage, reference.frame]}
        />
      </View>
    );
  }

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
        <CardPattern bank={bank} color={style.glow} />
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

        <BankMark bank={bank} color={style.labelColor} />
        <SvgText
          x={bank === "ozon" ? 24 : 70}
          y="45"
          fontSize={style.label.length > 11 ? 17 : 22}
          fontWeight="800"
          letterSpacing={bank === "tinkoff" ? 0.5 : 0.2}
          fill={style.labelColor}
        >
          {style.label}
        </SvgText>
        <Rect x="25" y="70" width="34" height="24" rx="5" fill={style.chip} opacity={0.92} />
        <Path d="M25 82H59M42 70V94" stroke={style.colors[1]} strokeWidth="1" opacity={0.5} />
        <Path
          d="M70 76c5 5 5 13 0 18M76 72c8 8 8 20 0 28"
          stroke={style.labelColor}
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
          opacity={0.8}
        />

        {!compact ? (
          <>
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
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  referenceViewport: {
    borderRadius: 18,
    overflow: "hidden",
  },
  referenceImage: {
    position: "absolute",
  },
});

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
