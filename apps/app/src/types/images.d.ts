// Metro turns an imported image into an asset reference React Native's <Image> accepts.
declare module "*.webp" {
  import type { ImageSourcePropType } from "react-native";
  const source: ImageSourcePropType;
  export default source;
}
