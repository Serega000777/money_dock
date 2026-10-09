import Svg, { Circle, Path, Rect } from "react-native-svg";

/**
 * Every icon in the app, hand-drawn on a 24px grid with one stroke weight — no emoji
 * anywhere, and no icon-font dependency, so weight and corner radius stay consistent
 * with the rest of the interface.
 */
export type IconName =
  // navigation
  | "home"
  | "list"
  | "chart"
  | "person"
  | "plus"
  | "mic"
  | "chevron"
  | "chevronLeft"
  | "close"
  | "check"
  | "trash"
  | "note"
  | "pin"
  | "calendar"
  | "upload"
  | "inbox"
  | "card"
  | "sun"
  | "moon"
  | "backspace"
  | "telegram"
  // onboarding
  | "sparkle"
  | "arrowRight"
  | "arrowUpRight"
  | "shield"
  | "lock"
  | "eye"
  | "eyeOff"
  | "refresh"
  | "link"
  | "target"
  | "pie"
  | "keyboardOff"
  | "bolt"
  | "palm"
  | "receipt"
  | "bulb"
  | "camera"
  | "crown"
  | "headset"
  | "mail"
  | "star"
  | "bank"
  // categories
  | "cart"
  | "cutlery"
  | "car"
  | "fuel"
  | "house"
  | "health"
  | "film"
  | "shirt"
  | "wifi"
  | "wallet"
  | "briefcase"
  | "gift"
  | "book"
  | "phone"
  | "plane"
  | "coffee"
  | "carWash"
  | "wrench"
  | "tire"
  | "taxi"
  | "parking"
  | "bus"
  | "hammer"
  | "roller"
  | "sofa"
  | "drop"
  | "scissors"
  | "lipstick"
  | "tv"
  | "music"
  | "gamepad"
  | "cloud"
  | "paw"
  | "stroller"
  | "pill"
  | "tooth"
  | "dumbbell"
  | "school"
  | "bed"
  | "box"
  | "bag"
  | "laptop"
  | "flower"
  | "wine"
  | "dots";

interface Props {
  name: IconName;
  color: string;
  size?: number;
  strokeWidth?: number;
  /** Solid silhouette instead of an outline — the active-tab look (spec: match the
   * reference's bold-when-selected tab bar). Only defined for the four tab icons; other
   * names ignore it and keep their outline. */
  filled?: boolean;
}

export function Icon({ name, color, size = 24, strokeWidth = 1.7, filled = false }: Props) {
  const s = {
    stroke: color,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "home" ? (
        filled ? (
          <Path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 3.6 3 11h2.4v8.4h5.1v-6h3v6h5.1V11H21z"
            fill={color}
          />
        ) : (
          <>
            <Path d="M3.6 10.3 12 3.9l8.4 6.4" {...s} />
            <Path d="M5.7 9.1v10.2h12.6V9.1" {...s} />
          </>
        )
      ) : null}

      {name === "list" ? (
        filled ? (
          <>
            <Rect x="4" y="6" width="16" height="2.6" rx="1.3" fill={color} />
            <Rect x="4" y="10.7" width="16" height="2.6" rx="1.3" fill={color} />
            <Rect x="4" y="15.4" width="10" height="2.6" rx="1.3" fill={color} />
          </>
        ) : (
          <Path d="M4 7h16M4 12h16M4 17h10" {...s} />
        )
      ) : null}

      {name === "chart" ? (
        filled ? (
          <>
            <Rect x="4.5" y="18.6" width="15" height="1.4" rx="0.7" fill={color} />
            <Rect x="6.1" y="12.6" width="3" height="5.6" rx="1" fill={color} />
            <Rect x="10.5" y="6.4" width="3" height="11.8" rx="1" fill={color} />
            <Rect x="14.9" y="9.8" width="3" height="8.4" rx="1" fill={color} />
          </>
        ) : (
          <>
            <Path d="M4.5 19.4h15" {...s} />
            <Path d="M7.6 19.4v-6.2M12 19.4V6.4M16.4 19.4v-8.6" {...s} />
          </>
        )
      ) : null}

      {name === "person" ? (
        filled ? (
          <>
            <Circle cx="12" cy="8.6" r="3.5" fill={color} />
            <Path d="M5.5 19.4c.9-3.3 3.4-5.1 6.5-5.1s5.6 1.8 6.5 5.1z" fill={color} />
          </>
        ) : (
          <>
            <Circle cx="12" cy="8.6" r="3.5" {...s} />
            <Path d="M5.5 19.4c.9-3.3 3.4-5.1 6.5-5.1s5.6 1.8 6.5 5.1" {...s} />
          </>
        )
      ) : null}

      {name === "plus" ? <Path d="M12 5.5v13M5.5 12h13" {...s} /> : null}

      {name === "mic" ? (
        <>
          <Path
            d="M12 4.2a2.6 2.6 0 0 1 2.6 2.6v4.6a2.6 2.6 0 0 1-5.2 0V6.8A2.6 2.6 0 0 1 12 4.2Z"
            {...s}
          />
          <Path d="M6.4 11.2a5.6 5.6 0 0 0 11.2 0M12 16.8v3" {...s} />
        </>
      ) : null}

      {name === "chevron" ? <Path d="M9.5 5.5 16 12l-6.5 6.5" {...s} /> : null}
      {name === "chevronLeft" ? <Path d="M14.5 5.5 8 12l6.5 6.5" {...s} /> : null}
      {name === "close" ? <Path d="M6.5 6.5l11 11M17.5 6.5l-11 11" {...s} /> : null}
      {name === "check" ? <Path d="M5.5 12.5 10 17l8.5-9.5" {...s} /> : null}

      {name === "trash" ? (
        <>
          <Path d="M4.8 7h14.4M9.5 7V5.3h5V7M6.6 7l.9 12h9l.9-12" {...s} />
        </>
      ) : null}

      {name === "pin" ? (
        <>
          <Path d="M9.4 3.8h5.2l-.8 5 3 2.6v1.4H7.2v-1.4l3-2.6z" {...s} />
          <Path d="M12 12.8v7.4" {...s} />
        </>
      ) : null}

      {name === "calendar" ? (
        <>
          <Rect x="4" y="5.5" width="16" height="14.5" rx="2.4" {...s} />
          <Path d="M4.4 9.5h15.2M8 3.6v3.2M16 3.6v3.2" {...s} />
        </>
      ) : null}

      {name === "note" ? (
        <>
          <Path d="M6 4.5h8.5L18.5 8.5V19.5H6z" {...s} />
          <Path d="M14.2 4.6v4.1h4.1M9 13h6M9 16h4" {...s} />
        </>
      ) : null}

      {name === "upload" ? (
        <>
          <Path d="M12 15.5V4.8M8.2 8.4 12 4.6l3.8 3.8" {...s} />
          <Path d="M4.8 14.5v3.4a1.6 1.6 0 0 0 1.6 1.6h11.2a1.6 1.6 0 0 0 1.6-1.6v-3.4" {...s} />
        </>
      ) : null}

      {name === "inbox" ? (
        <>
          <Path
            d="M4.6 13.4 6.8 5.2h10.4l2.2 8.2v4.2a1.4 1.4 0 0 1-1.4 1.4H6a1.4 1.4 0 0 1-1.4-1.4z"
            {...s}
          />
          <Path d="M4.6 13.4h4l1 2.2h4.8l1-2.2h4" {...s} />
        </>
      ) : null}

      {name === "card" ? (
        <>
          <Rect x="3.4" y="5.8" width="17.2" height="12.4" rx="2.6" {...s} />
          <Path d="M3.4 10h17.2M6.8 14.6h3.4" {...s} />
        </>
      ) : null}

      {name === "sun" ? (
        <>
          <Circle cx="12" cy="12" r="3.9" {...s} />
          <Path
            d="M12 3v1.8M12 19.2V21M3 12h1.8M19.2 12H21M5.6 5.6l1.3 1.3M17.1 17.1l1.3 1.3M18.4 5.6l-1.3 1.3M6.9 17.1l-1.3 1.3"
            {...s}
          />
        </>
      ) : null}

      {name === "moon" ? (
        <Path d="M19.4 14.2A7.6 7.6 0 0 1 9.8 4.6a7.8 7.8 0 1 0 9.6 9.6Z" {...s} />
      ) : null}

      {name === "backspace" ? (
        <>
          <Path d="M9.6 6h9a1.8 1.8 0 0 1 1.8 1.8v8.4A1.8 1.8 0 0 1 18.6 18h-9L3.6 12Z" {...s} />
          <Path d="M10.4 9.6l5 5M15.4 9.6l-5 5" {...s} />
        </>
      ) : null}

      {name === "telegram" ? (
        <Path
          d="m3.4 12.4 16.3-6.9c.8-.3 1.5.4 1.2 1.2L18 19.4c-.3.9-1.4 1.1-2 .4l-4-3.6-2.3 2.2c-.5.5-1.3.2-1.3-.5v-3.6L3 13.6c-.8-.3-.8-1-.4-1.2Z"
          fill={color}
          stroke="none"
        />
      ) : null}

      {/* onboarding */}
      {name === "sparkle" ? (
        <Path
          d="M12 2.8c.7 4.8 3.6 7.7 8.4 8.4-4.8.7-7.7 3.6-8.4 8.4-.7-4.8-3.6-7.7-8.4-8.4 4.8-.7 7.7-3.6 8.4-8.4Z"
          fill={color}
          stroke="none"
        />
      ) : null}

      {name === "arrowRight" ? <Path d="M4.5 12h14M13 6.4 18.6 12 13 17.6" {...s} /> : null}
      {name === "arrowUpRight" ? <Path d="M7.4 16.6 16.6 7.4M9.2 7.4h7.4v7.4" {...s} /> : null}

      {name === "shield" ? (
        <>
          <Path d="M12 3.4 19 6.1v5.2c0 4.2-2.8 7.2-7 9.3-4.2-2.1-7-5.1-7-9.3V6.1z" {...s} />
          <Path d="M9.2 11.8 11.4 14l3.6-3.8" {...s} />
        </>
      ) : null}

      {name === "lock" ? (
        <>
          <Rect x="4.8" y="10.4" width="14.4" height="9.6" rx="2.6" {...s} />
          <Path d="M8.4 10.4V8.2a3.6 3.6 0 0 1 7.2 0v2.2" {...s} />
        </>
      ) : null}

      {name === "eye" ? (
        <>
          <Path d="M4 12s3.3-5.4 8-5.4S20 12 20 12s-3.3 5.4-8 5.4S4 12 4 12Z" {...s} />
          <Circle cx="12" cy="12" r="2.8" {...s} />
        </>
      ) : null}

      {name === "eyeOff" ? (
        <>
          <Path
            d="M4 12s3.3-5.4 8-5.4c1.3 0 2.5.4 3.6 1M20 12s-3.3 5.4-8 5.4c-1.4 0-2.6-.4-3.7-1.1"
            {...s}
          />
          <Path d="M9.8 9.9a3 3 0 0 0 4.3 4.2M4.2 4.2l15.6 15.6" {...s} />
        </>
      ) : null}

      {name === "refresh" ? (
        <>
          <Path d="M19.4 12a7.4 7.4 0 0 1-12.7 5.2M4.6 12A7.4 7.4 0 0 1 17.3 6.8" {...s} />
          <Path d="M17.4 3.8v3.2h-3.2M6.6 20.2V17h3.2" {...s} />
        </>
      ) : null}

      {name === "link" ? (
        <>
          <Path d="M10.3 13.7a3.6 3.6 0 0 0 5.1 0l2.4-2.4a3.6 3.6 0 1 0-5.1-5.1l-1.2 1.2" {...s} />
          <Path d="M13.7 10.3a3.6 3.6 0 0 0-5.1 0l-2.4 2.4a3.6 3.6 0 1 0 5.1 5.1l1.2-1.2" {...s} />
        </>
      ) : null}

      {name === "target" ? (
        <>
          <Circle cx="12" cy="12" r="8.4" {...s} />
          <Circle cx="12" cy="12" r="4.4" {...s} />
          <Circle cx="12" cy="12" r="1.5" fill={color} stroke="none" />
        </>
      ) : null}

      {name === "pie" ? (
        <>
          <Path d="M12.8 3.6a8.4 8.4 0 0 1 7.6 7.6h-7.6z" {...s} />
          <Path d="M10.8 5.2a8.4 8.4 0 1 0 8 8" {...s} />
        </>
      ) : null}

      {name === "keyboardOff" ? (
        <>
          <Rect x="3.2" y="7" width="17.6" height="10" rx="2.4" {...s} />
          <Path d="M7 10.4h.01M10.4 10.4h.01M13.8 10.4h.01M17.2 10.4h.01M8.4 13.6h7.2" {...s} />
          <Path d="M3.6 3.6 20.4 20.4" {...s} />
        </>
      ) : null}

      {name === "bolt" ? <Path d="M13.6 3.2 6.4 13.6h4.6l-1.2 7.2 7.2-10.4h-4.6z" {...s} /> : null}

      {name === "palm" ? (
        <>
          <Path d="M12.4 20.6c-.2-4.4.3-7.6 1.4-9.8" {...s} />
          <Path
            d="M13.8 10.8c-1.9-1.8-4.4-2.3-6.8-1.2M13.8 10.8c.4-2.5 2.2-4.4 4.8-4.9M13.8 10.8c-1.4-2-1.4-4.5.1-6.6M13.8 10.8c2.4.2 4.3 1.6 5.2 3.7"
            {...s}
          />
        </>
      ) : null}

      {name === "receipt" ? (
        <>
          <Path d="M5.6 3.8h12.8v16.4l-2.6-1.6-2.6 1.6-2.6-1.6-2.4 1.6z" {...s} />
          <Path d="M8.8 8.4h6.4M8.8 12.2h6.4" {...s} />
        </>
      ) : null}

      {name === "bulb" ? (
        <>
          <Path d="M9.2 15.6a5.6 5.6 0 1 1 5.6 0v1.8H9.2z" {...s} />
          <Path d="M10 20.2h4" {...s} />
        </>
      ) : null}

      {name === "camera" ? (
        <>
          <Path
            d="M9 4.6h6l1.2 2.2h2.4a1.6 1.6 0 0 1 1.6 1.6v9a1.6 1.6 0 0 1-1.6 1.6H5.4a1.6 1.6 0 0 1-1.6-1.6v-9a1.6 1.6 0 0 1 1.6-1.6h2.4z"
            {...s}
          />
          <Circle cx="12" cy="13" r="3.4" {...s} />
        </>
      ) : null}

      {name === "crown" ? (
        <Path d="M4.4 9.2 8 12l4-6.4L16 12l3.6-2.8-1.3 9.2H5.7Z" fill={color} stroke="none" />
      ) : null}

      {name === "headset" ? (
        <>
          <Path d="M4.4 13.4v-1.8a7.6 7.6 0 0 1 15.2 0v1.8" {...s} />
          <Path
            d="M4.4 13.4h1.8a1.4 1.4 0 0 1 1.4 1.4v2.8a1.4 1.4 0 0 1-1.4 1.4H4.4Zm15.2 0h-1.8a1.4 1.4 0 0 0-1.4 1.4v2.8a1.4 1.4 0 0 0 1.4 1.4h1.8Z"
            {...s}
          />
          <Path d="M17.4 19.4a3.4 3.4 0 0 1-3.4 2.2h-1.2" {...s} />
        </>
      ) : null}

      {name === "mail" ? (
        <>
          <Rect x="3.6" y="5.8" width="16.8" height="12.4" rx="2.2" {...s} />
          <Path d="M4.4 7.2 12 13l7.6-5.8" {...s} />
        </>
      ) : null}

      {name === "star" ? (
        <Path
          d="M12 3.6l2.5 5.2 5.7.7-4.2 4 1.1 5.7L12 16.4l-5.1 2.8 1.1-5.7-4.2-4 5.7-.7Z"
          fill={color}
          stroke="none"
        />
      ) : null}

      {name === "bank" ? (
        <>
          <Path d="M4 9.4 12 4.4l8 5" {...s} />
          <Path d="M5 9.4h14v2H5zM6 11.4v6.6M10 11.4v6.6M14 11.4v6.6M18 11.4v6.6" {...s} />
          <Path d="M4.4 19.6h15.2" {...s} />
        </>
      ) : null}

      {/* categories */}
      {name === "cart" ? (
        <>
          <Path d="M3.5 4.6h2.3l2.4 9.6h8.6l2.2-7.1H7" {...s} />
          <Circle cx="9.4" cy="18.4" r="1.4" {...s} />
          <Circle cx="16.4" cy="18.4" r="1.4" {...s} />
        </>
      ) : null}

      {name === "cutlery" ? (
        <Path
          d="M7 4v6.4a2 2 0 0 0 4 0V4M9 10.4V20M17 4c-1.6.8-2.4 2.4-2.4 4.4 0 1.6.8 2.6 2.4 2.8V20"
          {...s}
        />
      ) : null}

      {name === "car" ? (
        <>
          <Path
            d="M4.4 15.4v-2.1l1.8-4.4a1.6 1.6 0 0 1 1.5-1h8.6a1.6 1.6 0 0 1 1.5 1l1.8 4.4v2.1"
            {...s}
          />
          <Path d="M4.4 15.4h15.2v2.2h-2.6v-2.2M7 17.6H4.4v-2.2" {...s} />
          <Path d="M7.4 12.4h9.2" {...s} />
        </>
      ) : null}

      {name === "fuel" ? (
        <>
          <Path d="M5 20V6a1.6 1.6 0 0 1 1.6-1.6h5A1.6 1.6 0 0 1 13.2 6v14M4 20h10.2" {...s} />
          <Path d="M5 11h8.2M13.2 9.4h2.6l2 2.2v5.2a1.5 1.5 0 0 1-3 0v-3.4h-1.6" {...s} />
        </>
      ) : null}

      {name === "house" ? (
        <>
          <Path d="M3.8 10.6 12 4.2l8.2 6.4" {...s} />
          <Path d="M5.9 9.4v10h12.2v-10M10 19.4v-5h4v5" {...s} />
        </>
      ) : null}

      {name === "health" ? (
        <Path
          d="M12 19.6S4.4 15.2 4.4 9.9A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.6 2.5c0 5.3-7.6 9.7-7.6 9.7Z"
          {...s}
        />
      ) : null}

      {name === "film" ? (
        <>
          <Rect x="3.6" y="5.2" width="16.8" height="13.6" rx="2.2" {...s} />
          <Path
            d="M8 5.2v13.6M16 5.2v13.6M3.6 12h16.8M3.6 8.6h4.4M3.6 15.4h4.4M16 8.6h4.4M16 15.4h4.4"
            {...s}
          />
        </>
      ) : null}

      {name === "shirt" ? (
        <Path
          d="M8.6 4.2 4.2 6.6l1.6 3.6 2-.8V19.4h8.4V9.4l2 .8 1.6-3.6-4.4-2.4a3.4 3.4 0 0 1-6.8 0Z"
          {...s}
        />
      ) : null}

      {name === "wifi" ? (
        <>
          <Path
            d="M4.2 9.4a11 11 0 0 1 15.6 0M7 12.6a7 7 0 0 1 10 0M9.8 15.8a3 3 0 0 1 4.4 0"
            {...s}
          />
          <Circle cx="12" cy="18.8" r="0.9" fill={color} stroke="none" />
        </>
      ) : null}

      {name === "wallet" ? (
        <>
          <Path
            d="M4 8.2A2.2 2.2 0 0 1 6.2 6h11.4a2 2 0 0 1 2 2v9.6a2 2 0 0 1-2 2H6.2A2.2 2.2 0 0 1 4 17.4Z"
            {...s}
          />
          <Path d="M4 9.6h13.6" {...s} />
          <Circle cx="16.2" cy="13.8" r="1.2" {...s} />
        </>
      ) : null}

      {name === "briefcase" ? (
        <>
          <Rect x="3.6" y="7.6" width="16.8" height="11.2" rx="2.2" {...s} />
          <Path
            d="M9 7.6V6.2a1.6 1.6 0 0 1 1.6-1.6h2.8A1.6 1.6 0 0 1 15 6.2v1.4M3.6 12.6h16.8"
            {...s}
          />
        </>
      ) : null}

      {name === "gift" ? (
        <>
          <Rect x="3.8" y="9.4" width="16.4" height="4" rx="1" {...s} />
          <Path d="M5.4 13.4v6h13.2v-6M12 9.4v10" {...s} />
          <Path
            d="M12 9.4S10.6 5 8.6 5a2 2 0 0 0 0 4.4M12 9.4s1.4-4.4 3.4-4.4a2 2 0 0 1 0 4.4"
            {...s}
          />
        </>
      ) : null}

      {name === "book" ? (
        <Path
          d="M4.4 5.2h5.2A2.4 2.4 0 0 1 12 7.6v11.2a1.8 1.8 0 0 0-1.8-1.8H4.4Zm15.2 0h-5.2A2.4 2.4 0 0 0 12 7.6v11.2a1.8 1.8 0 0 1 1.8-1.8h5.8Z"
          {...s}
        />
      ) : null}

      {name === "phone" ? (
        <>
          <Rect x="6.8" y="3.4" width="10.4" height="17.2" rx="2.4" {...s} />
          <Path d="M10.8 17.6h2.4" {...s} />
        </>
      ) : null}

      {name === "plane" ? (
        <Path
          d="m10.6 4.6 1.4-1.2 1.4 1.2v6l6.6 3.8v1.8l-6.6-2v3.6l2 1.6v1.2L12 19.8l-3.4.8v-1.2l2-1.6v-3.6l-6.6 2v-1.8l6.6-3.8Z"
          {...s}
        />
      ) : null}

      {name === "coffee" ? (
        <>
          <Path d="M4.6 8.6h11.6v6a4 4 0 0 1-4 4H8.6a4 4 0 0 1-4-4Z" {...s} />
          <Path
            d="M16.2 10.2h1.6a2.2 2.2 0 0 1 0 4.4h-1.6M6.6 3.4v2.4M10.4 3.4v2.4M14.2 3.4v2.4"
            {...s}
          />
        </>
      ) : null}

      {name === "carWash" ? (
        <>
          <Path
            d="M4.4 18.4v-2.1l1.8-4.4a1.6 1.6 0 0 1 1.5-1h8.6a1.6 1.6 0 0 1 1.5 1l1.8 4.4v2.1"
            {...s}
          />
          <Path d="M4.4 18.4h15.2v2.2h-2.6v-2.2M7 20.6H4.4v-2.2M7.4 15.4h9.2" {...s} />
          <Path d="M8 3.6c.8 1.1 1.2 1.8 1.2 2.3a1.2 1.2 0 0 1-2.4 0c0-.5.4-1.2 1.2-2.3Z" {...s} />
          <Path d="M12 2.8c.8 1.1 1.2 1.8 1.2 2.3a1.2 1.2 0 0 1-2.4 0c0-.5.4-1.2 1.2-2.3Z" {...s} />
          <Path d="M16 3.6c.8 1.1 1.2 1.8 1.2 2.3a1.2 1.2 0 0 1-2.4 0c0-.5.4-1.2 1.2-2.3Z" {...s} />
        </>
      ) : null}

      {name === "wrench" ? (
        <>
          <Path
            d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"
            {...s}
          />
        </>
      ) : null}

      {name === "tire" ? (
        <>
          <Circle cx="12" cy="12" r="8" {...s} />
          <Circle cx="12" cy="12" r="3" {...s} />
          <Path
            d="M12 4v5M12 15v5M4 12h5M15 12h5M6.3 6.3l3.6 3.6M14.1 14.1l3.6 3.6M17.7 6.3l-3.6 3.6M9.9 14.1l-3.6 3.6"
            {...s}
          />
        </>
      ) : null}

      {name === "taxi" ? (
        <>
          <Path
            d="M4.4 16.9v-2.1l1.8-4.4a1.6 1.6 0 0 1 1.5-1h8.6a1.6 1.6 0 0 1 1.5 1l1.8 4.4v2.1"
            {...s}
          />
          <Path d="M4.4 16.9h15.2v2.2h-2.6v-2.2M7 19.1H4.4v-2.2M7.4 13.9h9.2" {...s} />
          <Path d="M9.6 5.4h4.8v4H9.6Z" {...s} />
        </>
      ) : null}

      {name === "parking" ? (
        <>
          <Rect x="4" y="4" width="16" height="16" rx="3.4" {...s} />
          <Path d="M10 16.4V7.6h2.8a2.6 2.6 0 0 1 0 5.2H10" {...s} />
        </>
      ) : null}

      {name === "bus" ? (
        <>
          <Rect x="5" y="3.6" width="14" height="14" rx="2.6" {...s} />
          <Path d="M5 10.6h14M9.4 6.4h5.2M7.6 17.6v2.4M16.4 17.6v2.4" {...s} />
          <Circle cx="8.4" cy="14.2" r="0.9" fill={color} stroke="none" />
          <Circle cx="15.6" cy="14.2" r="0.9" fill={color} stroke="none" />
        </>
      ) : null}

      {name === "hammer" ? (
        <>
          <Path d="M13.27 3.65 20.35 10.73l-2.82 2.82-7.08-7.08Z" {...s} />
          <Path d="M14 10 4.8 19.2" {...s} />
        </>
      ) : null}

      {name === "roller" ? (
        <>
          <Rect x="4" y="3.8" width="13" height="5" rx="1.6" {...s} />
          <Path d="M17 6.3h2.4v4.6l-7.4 1.8v2.4" {...s} />
          <Rect x="10.6" y="15.1" width="2.8" height="5.4" rx="1" {...s} />
        </>
      ) : null}

      {name === "sofa" ? (
        <>
          <Path d="M5.4 11.2V8.4A2.4 2.4 0 0 1 7.8 6h8.4a2.4 2.4 0 0 1 2.4 2.4v2.8" {...s} />
          <Path
            d="M3.6 13.2a1.8 1.8 0 0 1 3.6 0v1.6h9.6v-1.6a1.8 1.8 0 0 1 3.6 0v4.4H3.6Z"
            {...s}
          />
          <Path d="M5.6 17.6v1.8M18.4 17.6v1.8" {...s} />
        </>
      ) : null}

      {name === "drop" ? (
        <>
          <Path
            d="M12 3.6c3.2 4 5.2 7.1 5.2 9.8a5.2 5.2 0 0 1-10.4 0c0-2.7 2-5.8 5.2-9.8Z"
            {...s}
          />
          <Path d="M9.6 14a2.4 2.4 0 0 0 2.4 2.2" {...s} />
        </>
      ) : null}

      {name === "scissors" ? (
        <>
          <Circle cx="6.6" cy="7" r="2.6" {...s} />
          <Circle cx="6.6" cy="17" r="2.6" {...s} />
          <Path d="M8.8 8.4 19.6 17.6M8.8 15.6 19.6 6.4" {...s} />
        </>
      ) : null}

      {name === "lipstick" ? (
        <>
          <Rect x="8.4" y="12.4" width="7.2" height="8" rx="1" {...s} />
          <Path d="M9.6 12.4V7.2l4.8-3.2v8.4M8.4 15.6h7.2" {...s} />
        </>
      ) : null}

      {name === "tv" ? (
        <>
          <Rect x="3.4" y="5" width="17.2" height="11.6" rx="2.2" {...s} />
          <Path d="M8.6 20h6.8M12 16.6V20" {...s} />
          <Path d="M10.4 8.6v4.4l3.8-2.2Z" {...s} />
        </>
      ) : null}

      {name === "music" ? (
        <>
          <Path d="M9 17.4V5.6l10-1.8v11.6M9 8.8l10-1.8" {...s} />
          <Circle cx="6.8" cy="17.4" r="2.2" {...s} />
          <Circle cx="16.8" cy="15.4" r="2.2" {...s} />
        </>
      ) : null}

      {name === "gamepad" ? (
        <>
          <Path
            d="M7.4 7.6h9.2a4.2 4.2 0 0 1 4 3l1 4.4a2.6 2.6 0 0 1-4.6 2.2L15 15.4H9l-2 1.8a2.6 2.6 0 0 1-4.6-2.2l1-4.4a4.2 4.2 0 0 1 4-3Z"
            {...s}
          />
          <Path d="M7.8 10.4v3.2M6.2 12h3.2" {...s} />
          <Circle cx="15.4" cy="10.9" r="0.9" fill={color} stroke="none" />
          <Circle cx="17.3" cy="12.8" r="0.9" fill={color} stroke="none" />
        </>
      ) : null}

      {name === "cloud" ? (
        <>
          <Path d="M7.4 18.4a4 4 0 0 1-.6-8 5.6 5.6 0 0 1 10.8 1.4 3.4 3.4 0 0 1-.2 6.6Z" {...s} />
        </>
      ) : null}

      {name === "paw" ? (
        <>
          <Path
            d="M12 12.6c-2.6 0-5 2.6-5 4.8 0 1.4 1 2.2 2.4 2.2 1 0 1.6-.6 2.6-.6s1.6.6 2.6.6c1.4 0 2.4-.8 2.4-2.2 0-2.2-2.4-4.8-5-4.8Z"
            {...s}
          />
          <Circle cx="5.8" cy="10.4" r="1.6" {...s} />
          <Circle cx="9.4" cy="6.6" r="1.7" {...s} />
          <Circle cx="14.6" cy="6.6" r="1.7" {...s} />
          <Circle cx="18.2" cy="10.4" r="1.6" {...s} />
        </>
      ) : null}

      {name === "stroller" ? (
        <>
          <Path d="M12.6 4.2v6.8h7a7 7 0 0 0-7-6.8Z" {...s} />
          <Path
            d="M2.8 7.4h1.6l.8 3.6h14.4a5.4 5.4 0 0 1-5.4 5.4H9.6a4.6 4.6 0 0 1-4.4-5.4"
            {...s}
          />
          <Circle cx="8.6" cy="19" r="1.5" {...s} />
          <Circle cx="16" cy="19" r="1.5" {...s} />
        </>
      ) : null}

      {name === "pill" ? (
        <>
          <Path d="M10.2 19.4a4.4 4.4 0 0 1-6.2-6.2l9.2-9.2a4.4 4.4 0 0 1 6.2 6.2Z" {...s} />
          <Path d="M8.6 8.6l6.2 6.2" {...s} />
        </>
      ) : null}

      {name === "tooth" ? (
        <>
          <Path
            d="M7.6 4.2c-2.4 0-3.6 2-3.4 4.4.2 2.4 1.4 3.8 1.8 6.4.4 2.6.8 5 2.4 5 1.4 0 1.6-2.4 2-4 .3-1.2.8-1.8 1.6-1.8s1.3.6 1.6 1.8c.4 1.6.6 4 2 4 1.6 0 2-2.4 2.4-5 .4-2.6 1.6-4 1.8-6.4.2-2.4-1-4.4-3.4-4.4-1.8 0-2.6 1-4.4 1s-2.6-1-4.4-1Z"
            {...s}
          />
        </>
      ) : null}

      {name === "dumbbell" ? (
        <>
          <Rect x="4.8" y="6.6" width="3.2" height="10.8" rx="1" {...s} />
          <Rect x="16" y="6.6" width="3.2" height="10.8" rx="1" {...s} />
          <Path d="M8 12h8M2.8 9.6v4.8M21.2 9.6v4.8" {...s} />
        </>
      ) : null}

      {name === "school" ? (
        <>
          <Path d="M2.8 9.4 12 5l9.2 4.4L12 13.8Z" {...s} />
          <Path d="M6.4 11.2v4.2c0 1.4 2.6 2.8 5.6 2.8s5.6-1.4 5.6-2.8v-4.2M21.2 9.4v5" {...s} />
        </>
      ) : null}

      {name === "bed" ? (
        <>
          <Path
            d="M3.6 6v13.4M3.6 15.6h16.8v3.8M20.4 15.6v-3.4a2.4 2.4 0 0 0-2.4-2.4h-7.6v5.8"
            {...s}
          />
          <Circle cx="7.2" cy="12.4" r="1.8" {...s} />
        </>
      ) : null}

      {name === "box" ? (
        <>
          <Path d="M12 3.6 19.6 7.6v8.8L12 20.4l-7.6-4V7.6Z" {...s} />
          <Path d="M4.4 7.6 12 11.6l7.6-4M12 11.6v8.8M8.2 5.6l7.6 4" {...s} />
        </>
      ) : null}

      {name === "bag" ? (
        <>
          <Path d="M5.2 8.4h13.6l-1 11.2H6.2Z" {...s} />
          <Path d="M9 10.4V7.2a3 3 0 0 1 6 0v3.2" {...s} />
        </>
      ) : null}

      {name === "laptop" ? (
        <>
          <Rect x="5" y="5" width="14" height="10" rx="1.6" {...s} />
          <Path d="M3 18.6h18" {...s} />
        </>
      ) : null}

      {name === "flower" ? (
        <>
          <Path
            d="M12 13.2c-3 0-5-2.4-5-6V4.6l2.6 1.8L12 3.6l2.4 2.8L17 4.6v2.6c0 3.8-2 6-5 6Z"
            {...s}
          />
          <Path d="M12 13.2v7M12 17.6c-1.2-1.8-3-2.6-5-2.4.4 2 2.2 3.2 5 3.2" {...s} />
        </>
      ) : null}

      {name === "wine" ? (
        <>
          <Path d="M7.6 3.8h8.8l-.4 4.4a4 4 0 0 1-8 0Z" {...s} />
          <Path d="M12 12.2v7.6M8.6 19.8h6.8" {...s} />
        </>
      ) : null}

      {name === "dots" ? (
        <>
          <Circle cx="6.2" cy="12" r="1.4" fill={color} stroke="none" />
          <Circle cx="12" cy="12" r="1.4" fill={color} stroke="none" />
          <Circle cx="17.8" cy="12" r="1.4" fill={color} stroke="none" />
        </>
      ) : null}
    </Svg>
  );
}

/** Maps a seeded category's system_code to its icon; unknown codes fall back to dots. */
export const CATEGORY_ICONS: Record<string, IconName> = {
  groceries: "cart",
  restaurants: "cutlery",
  transport: "car",
  fuel: "fuel",
  housing: "house",
  health: "health",
  entertainment: "film",
  shopping: "shirt",
  communication: "wifi",
  other_expense: "dots",
  salary: "wallet",
  freelance: "briefcase",
  other_income: "dots",
};

/** Icons offered when creating a custom category. */
export const PICKABLE_ICONS: IconName[] = [
  // food & shopping
  "cart",
  "cutlery",
  "coffee",
  "wine",
  "bag",
  "box",
  "shirt",
  "gift",
  "flower",
  // transport & car
  "car",
  "taxi",
  "bus",
  "fuel",
  "parking",
  "carWash",
  "wrench",
  "tire",
  "plane",
  // home & utilities
  "house",
  "sofa",
  "drop",
  "bulb",
  "bolt",
  "wifi",
  "hammer",
  "roller",
  // health & beauty
  "health",
  "pill",
  "tooth",
  "dumbbell",
  "scissors",
  "lipstick",
  // leisure & subscriptions
  "film",
  "tv",
  "music",
  "gamepad",
  "refresh",
  "cloud",
  "book",
  "school",
  "bed",
  "palm",
  // family & tech
  "paw",
  "stroller",
  "phone",
  "laptop",
  // money
  "wallet",
  "briefcase",
  "card",
  "bank",
  "receipt",
  "shield",
  "star",
  "dots",
];
