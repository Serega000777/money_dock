import { ApiError } from "@money-dock/api-client";
import { useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiClient } from "../api/client";
import { signInDemo } from "../auth/AuthProvider";
import { Icon, type IconName } from "../ui/Icon";
import { Text } from "../ui/Text";
import { PressableScale } from "../ui/primitives";

import { OnboardingBackground } from "./OnboardingBackground";
import {
  Dots,
  GhostButton,
  GlassCard,
  Handwritten,
  IconBadge,
  OnboardingLogo,
  PrimaryButton,
  ScreenHeading,
} from "./OnboardingKit";
import { AccountsStep, AnalyticsStep, VoiceStep, WelcomeStep } from "./OnboardingSteps";
import { useOnboardingStore } from "./onboardingStore";
import { ob } from "./palette";

const TOUR = [
  {
    title: "Добро пожаловать",
    subtitle: "Управляйте деньгами легко, красиво и с умом",
    cta: "Начать",
    body: WelcomeStep,
  },
  {
    title: "Говорите — Amola запишет",
    subtitle: "Добавляйте расходы голосом за пару секунд",
    cta: "Далее",
    body: VoiceStep,
  },
  {
    title: "Все карты и счета в одном месте",
    subtitle: "Подключайте банки и следите за балансом без лишних действий",
    cta: "Далее",
    body: AccountsStep,
  },
  {
    title: "Аналитика, которая помогает",
    subtitle: "Смотрите прогресс, контролируйте бюджет и достигайте целей",
    cta: "Далее",
    body: AnalyticsStep,
  },
];

const AUTH_INDEX = TOUR.length;
const TOTAL = TOUR.length + 1;

export function OnboardingFlow() {
  const hasSeenOnboarding = useOnboardingStore((state) => state.hasSeenOnboarding);
  const markSeen = useOnboardingStore((state) => state.markSeen);
  // A returning visitor who already watched the tour lands straight on the auth screen.
  const [index, setIndex] = useState(hasSeenOnboarding ? AUTH_INDEX : 0);
  const [loginMode, setLoginMode] = useState(false);

  const goToAuth = (login: boolean) => {
    markSeen();
    setLoginMode(login);
    setIndex(AUTH_INDEX);
  };

  const step = TOUR[index];

  return (
    <View style={styles.root}>
      <OnboardingBackground />
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <OnboardingLogo />

          {step ? (
            <>
              <ScreenHeading title={step.title} subtitle={step.subtitle} />
              <step.body />
              <PrimaryButton
                label={step.cta}
                onPress={() => (index + 1 < AUTH_INDEX ? setIndex(index + 1) : goToAuth(false))}
              />
              {index === 0 ? (
                <FooterLink prefix="Уже есть аккаунт?" label="Войти" onPress={() => goToAuth(true)} />
              ) : null}
            </>
          ) : (
            <>
              <ScreenHeading
                title={loginMode ? "С возвращением" : "Создайте аккаунт"}
                subtitle={
                  loginMode
                    ? "Войдите, чтобы продолжить вести финансы"
                    : "Начните управлять финансами уже сегодня"
                }
              />
              <AuthStep loginMode={loginMode} onSwitchMode={setLoginMode} />
            </>
          )}

          <Dots total={TOTAL} active={index} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function FooterLink({
  prefix,
  label,
  onPress,
}: {
  prefix: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.footerRow}>
      <Text style={styles.footerPrefix}>{prefix} </Text>
      <PressableScale onPress={onPress} hitSlop={8}>
        <Text style={styles.footerLink}>{label}</Text>
      </PressableScale>
    </View>
  );
}

/* ---------------------------------------------------------------- registration */

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^8/, "7").replace(/^([^7])/, "7$1").slice(0, 11);
  if (digits.length <= 1) return digits ? "+7" : "";
  const rest = digits.slice(1);
  const parts = [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6, 8), rest.slice(8, 10)];
  let out = "+7";
  if (parts[0]) out += ` (${parts[0]}`;
  if (parts[0] && parts[0].length === 3) out += ")";
  if (parts[1]) out += ` ${parts[1]}`;
  if (parts[2]) out += `-${parts[2]}`;
  if (parts[3]) out += `-${parts[3]}`;
  return out;
}

function AuthStep({
  loginMode,
  onSwitchMode,
}: {
  loginMode: boolean;
  onSwitchMode: (login: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = () => {
    setNotice(null);
    if (!loginMode && !name.trim()) {
      setError("Как к вам обращаться?");
      return;
    }
    if (phone.replace(/\D/g, "").length !== 11) {
      setError("Введите номер телефона полностью");
      return;
    }
    if (password.length < 8 || !/[a-zA-Zа-яА-Я]/.test(password) || !/\d/.test(password)) {
      setError("Минимум 8 символов, включая буквы и цифры");
      return;
    }
    setError(null);
    // No SMS provider and no phone identity flow on the server yet — see
    // AuthService: only Telegram is wired, Yandex ID and VK ID are scaffolded stubs.
    setNotice(
      "Вход по номеру телефона скоро будет доступен. Пока откройте приложение из Telegram или продолжите без регистрации.",
    );
  };

  const social = async (provider: "telegram" | "yandex" | "vk") => {
    setError(null);
    if (provider === "telegram") {
      setNotice("Откройте Amola из Telegram, чтобы войти через него автоматически.");
      return;
    }
    setBusy(true);
    try {
      const redirectUri = "amola://auth/callback";
      if (provider === "yandex") await apiClient.auth.loginWithYandex("stub-code", redirectUri);
      else await apiClient.auth.loginWithVk("stub-code", redirectUri);
    } catch (caught) {
      setNotice(caught instanceof ApiError ? apiMessage(caught) : "Способ входа пока недоступен.");
    } finally {
      setBusy(false);
    }
  };

  const guest = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInDemo();
    } catch {
      setNotice("Не удалось войти. Проверьте соединение и попробуйте ещё раз.");
      setBusy(false);
    }
  };

  return (
    <View style={styles.authStep}>
      <View style={styles.floatingRow}>
        <IconBadge name="person" size={50} iconSize={22} style={styles.floatLeft} />
        <IconBadge name="chart" size={50} iconSize={22} style={styles.floatRight} />
      </View>

      <GlassCard style={styles.formCard}>
        <View style={styles.formHead}>
          <Text style={styles.formTitle}>Ваши данные</Text>
          <View style={styles.secureRow}>
            <Text style={styles.secureText}>Всё под защитой</Text>
            <Icon name="shield" color={ob.textSecondary} size={16} strokeWidth={1.9} />
          </View>
        </View>

        {loginMode ? null : (
          <Field icon="person" label="Имя">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Как к вам обращаться?"
              placeholderTextColor={ob.textMuted}
              style={styles.input}
            />
          </Field>
        )}

        {/* The reference shows the mask itself as the field's bright line, with the hint
            under it inside the field — the "Телефон" label from the spec is for screen
            readers only. */}
        <Field icon="phone" hint="Ваш номер телефона">
          <TextInput
            value={phone}
            onChangeText={(value) => setPhone(formatPhone(value))}
            placeholder="+7 (___) ___-__-__"
            placeholderTextColor="#E9DDF0"
            keyboardType="phone-pad"
            accessibilityLabel="Телефон"
            style={[styles.input, styles.inputProminent]}
          />
        </Field>

        <Field
          icon="lock"
          helper="Минимум 8 символов, включая буквы и цифры"
          trailing={
            <PressableScale onPress={() => setRevealed((value) => !value)} hitSlop={8}>
              <Icon
                name={revealed ? "eye" : "eyeOff"}
                color={ob.textSecondary}
                size={20}
                strokeWidth={1.8}
              />
            </PressableScale>
          }
        >
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Пароль"
            placeholderTextColor="#E9DDF0"
            secureTextEntry={!revealed}
            accessibilityLabel="Пароль"
            style={[styles.input, styles.inputProminent]}
          />
        </Field>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </GlassCard>

      <PrimaryButton label={loginMode ? "Войти" : "Зарегистрироваться"} onPress={submit} />

      <View style={styles.socialBlock}>
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>или войдите через</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialRow}>
          <SocialButton provider="telegram" label="Telegram" onPress={() => social("telegram")} />
          <SocialButton provider="yandex" label="Yandex ID" soon onPress={() => social("yandex")} />
          <SocialButton provider="vk" label="VK ID" soon onPress={() => social("vk")} />
        </View>
      </View>

      <GhostButton label="Продолжить без регистрации" onPress={guest} />

      {notice ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      <View style={styles.scriptRowBottom}>
        <Handwritten text="Больше возможностей вместе ♡" style={styles.scriptTiltLeft} />
        <Handwritten
          text="Финансовая свобода начинается здесь ♡"
          style={styles.scriptTiltRight}
        />
      </View>

      <FooterLink
        prefix={loginMode ? "Ещё нет аккаунта?" : "Уже есть аккаунт?"}
        label={loginMode ? "Создать" : "Войти"}
        onPress={() => onSwitchMode(!loginMode)}
      />

      {busy ? <Text style={styles.busy}>Секунду…</Text> : null}
    </View>
  );
}

function Field({
  icon,
  label,
  hint,
  helper,
  trailing,
  children,
}: {
  icon: IconName;
  /** Bright line above the input. */
  label?: string;
  /** Muted line under the input, inside the field. */
  hint?: string;
  /** Muted line under the whole field. */
  helper?: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldRow}>
        <Icon name={icon} color={ob.textSecondary} size={20} strokeWidth={1.8} />
        <View style={styles.fieldBody}>
          {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
          {children}
          {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
        </View>
        {trailing}
      </View>
      {helper ? <Text style={styles.fieldHelper}>{helper}</Text> : null}
    </View>
  );
}

/** Yandex and VK are lettermark badges, not their real logos — the providers are
 * scaffolded stubs (see AuthService.loginWithYandex / loginWithVk), so shipping their
 * brand marks would promise an integration that does not exist yet. */
function SocialButton({
  provider,
  label,
  soon,
  onPress,
}: {
  provider: "telegram" | "yandex" | "vk";
  label: string;
  soon?: boolean;
  onPress: () => void;
}) {
  return (
    // PressableScale puts `style` on its inner Animated.View, so flex has to live on a
    // wrapper for the three buttons to share the row.
    <View style={styles.socialSlot}>
      <PressableScale onPress={onPress} style={styles.social}>
      <View style={styles.socialMark}>
        {provider === "telegram" ? (
          <Icon name="telegram" color="#FFFFFF" size={20} />
        ) : (
          <Text style={styles.socialMarkText}>{provider === "yandex" ? "Я" : "VK"}</Text>
        )}
      </View>
      <Text style={styles.socialLabel}>{label}</Text>
      {soon ? (
        <View style={styles.soonBadge}>
          <Text style={styles.soonText}>скоро</Text>
        </View>
      ) : null}
      </PressableScale>
    </View>
  );
}

function apiMessage(error: ApiError): string {
  try {
    const body = JSON.parse(error.message) as { message?: string };
    return body.message ?? "Способ входа пока недоступен.";
  } catch {
    return "Способ входа пока недоступен.";
  }
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: ob.background[1],
  },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 32,
    gap: 20,
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
  },

  footerRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  footerPrefix: { color: ob.textMuted, fontSize: 13.5 },
  footerLink: {
    color: ob.glowPink,
    fontSize: 13.5,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  authStep: { gap: 18 },
  floatingRow: { flexDirection: "row", justifyContent: "space-between" },
  floatLeft: { transform: [{ rotate: "-9deg" }] },
  floatRight: { transform: [{ rotate: "9deg" }] },

  formCard: { padding: 18, gap: 14 },
  formHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  formTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  secureRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  secureText: { color: ob.textSecondary, fontSize: 12 },

  field: { gap: 5 },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: ob.fieldBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fieldBody: { flex: 1, gap: 1 },
  fieldLabel: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "600" },
  input: {
    color: "#FFFFFF",
    fontSize: 13.5,
    padding: 0,
    // react-native-web renders a focus ring that fights the field's own border.
    outlineWidth: 0,
  },
  inputProminent: { fontSize: 14.5, fontWeight: "600" },
  fieldHint: { color: ob.textMuted, fontSize: 11.5, marginTop: 2 },
  fieldHelper: { color: ob.textMuted, fontSize: 11, paddingHorizontal: 6 },
  error: { color: "#FF7DB4", fontSize: 12 },

  socialBlock: { gap: 12 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: ob.cardBorder },
  dividerText: { color: ob.textMuted, fontSize: 11.5 },
  socialRow: { flexDirection: "row", gap: 9 },
  socialSlot: { flex: 1 },
  social: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: ob.tileBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ob.cardBorder,
  },
  socialMark: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.09)",
    alignItems: "center",
    justifyContent: "center",
  },
  socialMarkText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  socialLabel: { color: ob.textSecondary, fontSize: 11.5, fontWeight: "600" },
  soonBadge: {
    backgroundColor: "rgba(255,39,201,0.18)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  soonText: { color: "#FF8EDC", fontSize: 9.5, fontWeight: "700" },

  notice: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 18,
    padding: 14,
  },
  noticeText: { color: ob.textSecondary, fontSize: 12.5, lineHeight: 17, textAlign: "center" },

  scriptRowBottom: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  scriptTiltLeft: { transform: [{ rotate: "-8deg" }] },
  scriptTiltRight: { alignItems: "flex-end", transform: [{ rotate: "7deg" }] },

  busy: { color: ob.textMuted, fontSize: 12, textAlign: "center" },
});
