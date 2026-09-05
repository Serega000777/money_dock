import Svg, { Circle, Path } from "react-native-svg";

export type TabIconName = "home" | "list" | "plus" | "chart" | "person";

interface Props {
  name: TabIconName;
  color: string;
  size?: number;
}

/**
 * Hand-drawn line icons on a 24px grid — no emoji, no icon-font dependency, so stroke
 * weight and corner radius stay consistent with the rest of the interface.
 */
export function TabIcon({ name, color, size = 24 }: Props) {
  const common = {
    stroke: color,
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "home" ? (
        <>
          <Path d="M3.5 10.2 12 3.8l8.5 6.4" {...common} />
          <Path d="M5.6 9v10.2h12.8V9" {...common} />
        </>
      ) : null}

      {name === "list" ? (
        <>
          <Path d="M4 7h16M4 12h16M4 17h10" {...common} />
        </>
      ) : null}

      {name === "plus" ? (
        <>
          <Circle cx="12" cy="12" r="8.5" {...common} />
          <Path d="M12 8.4v7.2M8.4 12h7.2" {...common} />
        </>
      ) : null}

      {name === "chart" ? (
        <>
          <Path d="M4 19.2h16" {...common} />
          <Path d="M7.2 19.2V11M12 19.2V5.6M16.8 19.2v-5.4" {...common} />
        </>
      ) : null}

      {name === "person" ? (
        <>
          <Circle cx="12" cy="8.6" r="3.6" {...common} />
          <Path d="M5.4 19.4c.9-3.4 3.5-5.2 6.6-5.2s5.7 1.8 6.6 5.2" {...common} />
        </>
      ) : null}
    </Svg>
  );
}
