import { Platform } from "react-native";

/**
 * What the App Store (iOS) build leaves out for its first release — one place to flip
 * when that changes. See docs/native-release.md.
 */
const APP_STORE_BUILD = Platform.OS === "ios";

/**
 * Pro is sold through Telegram Stars. Inside an iOS app Apple only allows its own in-app
 * purchase for a subscription, and pointing to any other way to pay is a rejection — so
 * until StoreKit is wired up, the iOS build never offers or mentions buying Pro. Free
 * limits still apply there; hitting one just says when it resets.
 */
export const CAN_SELL_PRO = !APP_STORE_BUILD;

/**
 * Bank logos and card art stay out of the iOS build: Apple screens apps for links to
 * sanctioned banks (several of these are), and the banks' trademark permission is still
 * being requested. Accounts keep working — they just show the plain card.
 */
export const SHOW_BANK_BRANDING = !APP_STORE_BUILD;

/**
 * Only Sign in with Apple is offered on iOS: the phone/Yandex/VK options aren't live yet,
 * and a login button that does nothing is a review rejection.
 */
export const APPLE_SIGN_IN_ONLY = APP_STORE_BUILD;

/** No "Скоро" teasers on iOS: Apple reads a visible not-yet-working feature as an
 * unfinished app (guideline 2.1). Unconfigured support links are hidden there too. */
export const SHOW_COMING_SOON = !APP_STORE_BUILD;
