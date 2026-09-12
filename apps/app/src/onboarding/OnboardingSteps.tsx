import { StyleSheet, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

import { GradientBox } from "../ui/Gradient";
import { Icon } from "../ui/Icon";
import { Text } from "../ui/Text";

import {
  FeatureRow,
  GlassCard,
  GlowOrb,
  Handwritten,
  IconBadge,
  ObProgress,
} from "./OnboardingKit";
import { ob, obCategoryColors } from "./palette";

/* ------------------------------------------------------------------ 1. welcome */

export function WelcomeStep() {
  return (
    <View style={styles.step}>
      <View style={styles.floatingRow}>
        <IconBadge name="chart" size={54} iconSize={24} style={styles.floatLeft} />
        <IconBadge name="wallet" size={54} iconSize={24} style={styles.floatRight} />
      </View>

      <GradientBox
        colors={ob.primaryGradient}
        diagonal
        highlight
        highlightSize={220}
        radius={ob.cardRadius}
        style={styles.heroCard}
      >
        <View style={styles.heroTop}>
          <View style={styles.heroTopLeft}>
            <Text style={styles.heroLabel}>Ваш баланс</Text>
            <Text style={styles.heroValue}>243 420 ₽</Text>
            <Text style={styles.heroMeta}>10 583 ₽ в день · осталось 23 дня</Text>
          </View>
          <View style={styles.heroSparkle}>
            <IconBadge name="sparkle" size={38} iconSize={17} />
            <Text style={styles.heroSparkleText}>Больше,{"\n"}чем финансы ♡</Text>
          </View>
        </View>

        <View style={styles.heroDivider} />

        <View style={styles.heroSplit}>
          <HeroStat
            icon="arrowUpRight"
            label="Расходы"
            value="19 520 ₽"
            note="+12% к прошлому месяцу"
          />
          <View style={styles.heroSplitDivider} />
          <HeroStat
            icon="wallet"
            label="Свободные деньги"
            value="243 420 ₽"
            note="Можно тратить с удовольствием"
          />
        </View>
      </GradientBox>

      <View style={styles.orbRow}>
        <Handwritten text="Твои цели ближе ♡" style={styles.scriptLeft} />
        <GlowOrb name="mic" size={86} />
        <Handwritten
          text="Маленькие траты — большие мечты ♡"
          style={styles.scriptRight}
        />
      </View>

      <FeatureRow
        items={[
          { icon: "receipt", title: "Учет расходов", subtitle: "Всё под контролем" },
          { icon: "mic", title: "Голосовой ввод", subtitle: "Быстро и удобно" },
          { icon: "chart", title: "Умная аналитика", subtitle: "Понятные выводы" },
        ]}
      />
    </View>
  );
}

function HeroStat({
  icon,
  label,
  value,
  note,
}: {
  icon: "arrowUpRight" | "wallet";
  label: string;
  value: string;
  note: string;
}) {
  return (
    <View style={styles.heroStat}>
      <View style={styles.heroStatHead}>
        <IconBadge name={icon} size={30} iconSize={15} />
        <Text style={styles.heroStatLabel}>{label}</Text>
      </View>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatNote}>{note}</Text>
    </View>
  );
}

/* --------------------------------------------------------------- 2. voice input */

const WAVE_HEIGHTS = [14, 26, 40, 22, 12];

export function VoiceStep() {
  return (
    <View style={styles.step}>
      <View style={styles.voiceBlock}>
        <View style={styles.voiceScripts}>
          <Handwritten text="Просто скажите ♡" style={styles.scriptTiltLeft} />
          <Handwritten text="Всё учтем ♡" style={styles.scriptTiltRight} />
        </View>
        <View style={styles.voiceRow}>
          <Soundwave align="right" />
          <GlowOrb name="mic" size={104} />
          <Soundwave align="left" />
        </View>
      </View>

      <View style={styles.bubbleWrap}>
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>«Кофе 340 рублей»</Text>
        </View>
        <View style={styles.bubbleTail} />
      </View>

      <GradientBox
        colors={ob.secondaryGradient}
        diagonal
        highlight
        highlightSize={180}
        radius={24}
        style={styles.resultCard}
      >
        <IconBadge name="coffee" size={46} iconSize={22} />
        <View style={styles.resultBody}>
          <Text style={styles.resultTitle}>Кофе 340 ₽</Text>
          <Text style={styles.resultMeta}>Кафе</Text>
          <Text style={styles.resultMeta}>Сегодня, 09:41</Text>
        </View>
        <View style={styles.resultStatus}>
          <View style={styles.resultCheck}>
            <Icon name="check" color="#FFFFFF" size={16} strokeWidth={2.4} />
          </View>
          <Text style={styles.resultStatusText}>Записано</Text>
        </View>
      </GradientBox>

      <FeatureRow
        items={[
          { icon: "bolt", title: "Быстрый ввод", subtitle: "Пара секунд" },
          { icon: "keyboardOff", title: "Без ручного набора", subtitle: "Просто говорите" },
          { icon: "sparkle", title: "Умное распознавание", subtitle: "Понимает контекст" },
        ]}
      />
    </View>
  );
}

function Soundwave({ align }: { align: "left" | "right" }) {
  const bars = align === "left" ? [...WAVE_HEIGHTS].reverse() : WAVE_HEIGHTS;
  return (
    <View style={styles.soundwave}>
      {bars.map((height, i) => (
        <View key={i} style={[styles.waveBar, { height }]} />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ 3. accounts */

export function AccountsStep() {
  return (
    <View style={styles.step}>
      <Handwritten text="Все ваши банки здесь ♡" style={styles.scriptFloatLeft} />

      <View style={styles.bankRow}>
        <BankCard
          bank="Тинькофф"
          type="Дебетовая карта"
          masked="**** 4321"
          balance="87 230 ₽"
          paymentSystem="VISA"
          accent="#FFDD2D"
          accentInk="#22201A"
          tilt="-6deg"
        />
        <BankCard
          bank="СберБанк"
          type="Зарплатная карта"
          masked="**** 7712"
          balance="156 190 ₽"
          paymentSystem="Mastercard"
          accent="#21A038"
          accentInk="#FFFFFF"
          tilt="5deg"
        />
      </View>

      <GlassCard style={styles.panel}>
        <View style={styles.panelHead}>
          <Text style={styles.panelTitle}>Счета и карты</Text>
          <View style={styles.panelLink}>
            <Text style={styles.panelLinkText}>Все счета</Text>
            <Icon name="chevron" color={ob.textMuted} size={14} strokeWidth={2.2} />
          </View>
        </View>

        <View style={styles.panelTotalRow}>
          <View>
            <Text style={styles.panelTotal}>243 420 ₽</Text>
            <Text style={styles.panelTotalLabel}>Общий баланс</Text>
          </View>
          <GradientBox
            colors={ob.secondaryGradient}
            horizontal
            radius={999}
            style={styles.importButton}
          >
            <View>
              <Icon name="plus" color="#FFFFFF" size={16} strokeWidth={2.4} />
            </View>
            <Text style={styles.importLabel}>Импорт из банка</Text>
          </GradientBox>
        </View>

        <View style={styles.accountList}>
          <AccountRow
            bank="Тинькофф"
            type="Дебетовая карта"
            balance="87 230 ₽"
            accent="#FFDD2D"
            accentInk="#22201A"
          />
          <AccountRow
            bank="СберБанк"
            type="Зарплатная карта"
            balance="156 190 ₽"
            accent="#21A038"
            accentInk="#FFFFFF"
          />
          <AccountRow
            bank="Накопительный счет"
            type="11% годовых"
            balance="0 ₽"
            accent="rgba(255,255,255,0.16)"
            accentInk="#FFFFFF"
          />
        </View>
      </GlassCard>

      <Handwritten
        text="Больше контроля — больше свободы ♡"
        style={styles.scriptFloatRight}
      />

      <FeatureRow
        items={[
          { icon: "pie", title: "Единый баланс", subtitle: "Все средства на одном экране" },
          { icon: "refresh", title: "Автообновление", subtitle: "Актуальные данные всегда" },
          { icon: "link", title: "Удобный импорт", subtitle: "Безопасное подключение банков" },
        ]}
      />
    </View>
  );
}

/** Bank marks are lettermark badges in the bank's own colour, not reproductions of the
 * banks' or payment networks' logos — naming them in text is fine, redrawing their marks
 * is not something to ship. */
function BankCard({
  bank,
  type,
  masked,
  balance,
  paymentSystem,
  accent,
  accentInk,
  tilt,
}: {
  bank: string;
  type: string;
  masked: string;
  balance: string;
  paymentSystem: string;
  accent: string;
  accentInk: string;
  tilt: string;
}) {
  return (
    <View style={[styles.bankCard, { transform: [{ rotate: tilt }] }]}>
      <View style={styles.bankHead}>
        <View style={[styles.bankMark, { backgroundColor: accent }]}>
          <Text style={[styles.bankMarkText, { color: accentInk }]}>{bank.slice(0, 1)}</Text>
        </View>
        <View style={styles.bankNames}>
          <Text style={styles.bankName}>{bank}</Text>
          <Text style={styles.bankType}>{type}</Text>
        </View>
      </View>
      <Text style={styles.bankMasked}>{masked}</Text>
      <View style={styles.bankFoot}>
        <Text style={styles.bankBalance}>{balance}</Text>
        <Text style={styles.bankSystem}>{paymentSystem}</Text>
      </View>
    </View>
  );
}

function AccountRow({
  bank,
  type,
  balance,
  accent,
  accentInk,
}: {
  bank: string;
  type: string;
  balance: string;
  accent: string;
  accentInk: string;
}) {
  return (
    <View style={styles.accountRow}>
      <View style={[styles.bankMark, styles.accountMark, { backgroundColor: accent }]}>
        <Text style={[styles.bankMarkText, { color: accentInk }]}>{bank.slice(0, 1)}</Text>
      </View>
      <View style={styles.accountNames}>
        <Text style={styles.accountName}>{bank}</Text>
        <Text style={styles.accountType}>{type}</Text>
      </View>
      <Text style={styles.accountBalance}>{balance}</Text>
      <Icon name="chevron" color={ob.textMuted} size={14} strokeWidth={2.2} />
    </View>
  );
}

/* ----------------------------------------------------------------- 4. analytics */

const CATEGORIES = [
  { name: "Жилье", percent: 32 },
  { name: "Еда", percent: 24 },
  { name: "Транспорт", percent: 15 },
  { name: "Развлечения", percent: 12 },
  { name: "Другое", percent: 17 },
];

export function AnalyticsStep() {
  return (
    <View style={styles.step}>
      <View style={styles.floatingRow}>
        <IconBadge name="chart" size={50} iconSize={22} style={styles.floatLeft} />
        <IconBadge name="pie" size={50} iconSize={22} style={styles.floatRight} />
      </View>

      <GradientBox
        colors={ob.primaryGradient}
        diagonal
        highlight
        highlightSize={200}
        radius={ob.cardRadius}
        style={styles.budgetCard}
      >
        <View style={styles.budgetHead}>
          <View style={styles.budgetHeadLeft}>
            <Text style={styles.budgetLabel}>Бюджет на март</Text>
            <Text style={styles.budgetValue}>19 520 ₽</Text>
          </View>
          <View style={styles.budgetHeadRight}>
            <Text style={styles.budgetLimit}>Из 30 000 ₽</Text>
            <Text style={styles.budgetPercent}>65%</Text>
          </View>
          <IconBadge name="wallet" size={44} iconSize={21} />
        </View>
        <ObProgress share={0.65} />
        <Text style={styles.budgetFoot}>Осталось 10 480 ₽ · 12 дней</Text>
      </GradientBox>

      <View style={styles.analyticsRow}>
        <GlassCard style={styles.categoryCard}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Расходы по категориям</Text>
          </View>
          <View style={styles.panelLink}>
            <Text style={styles.panelLinkText}>Весь месяц</Text>
            <Icon name="chevron" color={ob.textMuted} size={13} strokeWidth={2.2} />
          </View>

          <View style={styles.donutRow}>
            <MiniDonut />
            <View style={styles.legend}>
              {CATEGORIES.map((category, i) => (
                <View key={category.name} style={styles.legendRow}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: obCategoryColors[i] ?? ob.glowViolet },
                    ]}
                  />
                  <Text style={styles.legendName}>{category.name}</Text>
                  <Text style={styles.legendPercent}>{category.percent}%</Text>
                </View>
              ))}
            </View>
          </View>
        </GlassCard>

        <GlassCard style={styles.goalCard}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Моя цель</Text>
            <Icon name="chevron" color={ob.textMuted} size={14} strokeWidth={2.2} />
          </View>
          <View style={styles.goalBody}>
            <IconBadge name="palm" size={44} iconSize={21} />
            <View style={styles.goalNames}>
              <Text style={styles.goalName}>Отпуск ☀️</Text>
              <Text style={styles.goalTarget}>200 000 ₽</Text>
            </View>
          </View>
          <View style={styles.goalProgressRow}>
            <View style={styles.goalProgress}>
              <ObProgress share={0.42} height={7} />
            </View>
            <Text style={styles.goalPercent}>42%</Text>
          </View>
          <Text style={styles.goalSaved}>Уже накоплено 84 000 ₽</Text>
        </GlassCard>
      </View>

      <View style={styles.orbRow}>
        <Handwritten text="Большие цели ближе ♡" style={styles.scriptLeft} />
        <GlowOrb name="chart" size={86} />
        <Handwritten
          text="Финансовая свобода — это реальность ♡"
          style={styles.scriptRight}
        />
      </View>

      <FeatureRow
        items={[
          { icon: "chart", title: "Прогресс месяца", subtitle: "Всё наглядно и понятно" },
          { icon: "bulb", title: "Умные подсказки", subtitle: "Персональные рекомендации" },
          { icon: "target", title: "Финансовые цели", subtitle: "Мотивируют двигаться дальше" },
        ]}
      />
    </View>
  );
}

const DONUT_SIZE = 104;
const DONUT_STROKE = 18;
const DONUT_R = (DONUT_SIZE - DONUT_STROKE) / 2;
const DONUT_C = 2 * Math.PI * DONUT_R;

function MiniDonut() {
  let offset = 0;
  return (
    <View style={styles.donut}>
      <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
        <G transform={`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}>
          {CATEGORIES.map((category, i) => {
            const length = (category.percent / 100) * DONUT_C - 2;
            const dashOffset = -offset;
            offset += (category.percent / 100) * DONUT_C;
            return (
              <Circle
                key={category.name}
                cx={DONUT_SIZE / 2}
                cy={DONUT_SIZE / 2}
                r={DONUT_R}
                stroke={obCategoryColors[i] ?? ob.glowViolet}
                strokeWidth={DONUT_STROKE}
                strokeLinecap="round"
                strokeDasharray={[length, DONUT_C - length]}
                strokeDashoffset={dashOffset}
                fill="none"
              />
            );
          })}
        </G>
      </Svg>
      <View style={styles.donutCenter} pointerEvents="none">
        <Text style={styles.donutValue}>19 520 ₽</Text>
        <Text style={styles.donutLabel}>всего</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { gap: 18 },

  floatingRow: { flexDirection: "row", justifyContent: "space-between" },
  floatLeft: { transform: [{ rotate: "-9deg" }] },
  floatRight: { transform: [{ rotate: "9deg" }] },

  /* welcome */
  heroCard: { padding: 18, gap: 14 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  heroTopLeft: { flex: 1, gap: 2 },
  heroLabel: { color: "rgba(255,255,255,0.86)", fontSize: 13 },
  heroValue: { color: "#FFFFFF", fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
  heroMeta: { color: "rgba(255,255,255,0.78)", fontSize: 11.5, marginTop: 2 },
  heroSparkle: { alignItems: "center", gap: 5, maxWidth: 96 },
  heroSparkleText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 10.5,
    lineHeight: 13,
    textAlign: "center",
  },
  heroDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.25)" },
  heroSplit: { flexDirection: "row", gap: 12 },
  heroSplitDivider: { width: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.25)" },
  heroStat: { flex: 1, gap: 4 },
  heroStatHead: { flexDirection: "row", alignItems: "center", gap: 7 },
  heroStatLabel: { color: "rgba(255,255,255,0.88)", fontSize: 12, flexShrink: 1 },
  heroStatValue: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  heroStatNote: { color: "rgba(255,255,255,0.7)", fontSize: 10.5, lineHeight: 13 },

  orbRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  scriptLeft: { position: "absolute", left: 0, transform: [{ rotate: "-8deg" }] },
  scriptRight: {
    position: "absolute",
    right: 0,
    transform: [{ rotate: "7deg" }],
    alignItems: "flex-end",
  },

  /* voice */
  voiceBlock: { marginTop: -6 },
  voiceScripts: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    zIndex: 1,
    marginBottom: -22,
  },
  scriptTiltLeft: { transform: [{ rotate: "-8deg" }] },
  scriptTiltRight: { alignItems: "flex-end", transform: [{ rotate: "7deg" }] },
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  soundwave: { flexDirection: "row", alignItems: "center", gap: 5 },
  waveBar: { width: 4, borderRadius: 999, backgroundColor: "rgba(255,63,210,0.75)" },

  bubbleWrap: { alignItems: "center", marginTop: -4 },
  bubble: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  bubbleText: { color: "#FFFFFF", fontSize: 15, fontStyle: "italic" },
  bubbleTail: {
    width: 10,
    height: 10,
    marginTop: -5,
    transform: [{ rotate: "45deg" }],
    backgroundColor: "rgba(255,255,255,0.09)",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
  },

  resultCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  resultBody: { flex: 1, gap: 1 },
  resultTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  resultMeta: { color: "rgba(255,255,255,0.78)", fontSize: 11.5 },
  resultStatus: { alignItems: "center", gap: 5 },
  resultCheck: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  resultStatusText: { color: "rgba(255,255,255,0.9)", fontSize: 10.5 },

  /* accounts */
  scriptFloatLeft: { alignSelf: "flex-start", transform: [{ rotate: "-8deg" }] },
  scriptFloatRight: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
    transform: [{ rotate: "7deg" }],
  },
  bankRow: { flexDirection: "row", gap: 10, justifyContent: "center" },
  bankCard: {
    flex: 1,
    backgroundColor: "rgba(30, 12, 38, 0.9)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 18,
    padding: 13,
    gap: 8,
    shadowColor: ob.glowPink,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 6,
  },
  bankHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  bankMark: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  bankMarkText: { fontSize: 13, fontWeight: "800" },
  bankNames: { flex: 1 },
  bankName: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "700" },
  bankType: { color: ob.textMuted, fontSize: 10 },
  bankMasked: { color: ob.textSecondary, fontSize: 11, letterSpacing: 1.5 },
  bankFoot: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  bankBalance: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  bankSystem: { color: ob.textMuted, fontSize: 9.5, letterSpacing: 1 },

  panel: { padding: 16, gap: 14 },
  panelHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  panelTitle: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "700" },
  panelLink: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  panelLinkText: { color: ob.textMuted, fontSize: 11.5 },
  panelTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  panelTotal: { color: "#FFFFFF", fontSize: 26, fontWeight: "800" },
  panelTotalLabel: { color: ob.textMuted, fontSize: 11.5 },
  importButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  importLabel: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "700" },
  accountList: { gap: 10 },
  accountRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  accountMark: { width: 30, height: 30, borderRadius: 10 },
  accountNames: { flex: 1 },
  accountName: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  accountType: { color: ob.textMuted, fontSize: 10.5 },
  accountBalance: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "700" },

  /* analytics */
  budgetCard: { padding: 18, gap: 12 },
  budgetHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  budgetHeadLeft: { flex: 1, gap: 2 },
  budgetLabel: { color: "rgba(255,255,255,0.86)", fontSize: 12.5 },
  budgetValue: { color: "#FFFFFF", fontSize: 30, fontWeight: "800" },
  budgetHeadRight: { alignItems: "flex-end", gap: 2 },
  budgetLimit: { color: "rgba(255,255,255,0.82)", fontSize: 11.5 },
  budgetPercent: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  budgetFoot: { color: "rgba(255,255,255,0.8)", fontSize: 11.5 },

  analyticsRow: { flexDirection: "row", gap: 10 },
  categoryCard: { flex: 1.2, padding: 13, gap: 6 },
  goalCard: { flex: 1, padding: 12, gap: 10 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "700", flexShrink: 1 },

  donutRow: { alignItems: "center", gap: 10 },
  donut: { width: DONUT_SIZE, height: DONUT_SIZE, alignItems: "center", justifyContent: "center" },
  donutCenter: { position: "absolute", alignItems: "center" },
  donutValue: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  donutLabel: { color: ob.textMuted, fontSize: 9.5 },
  legend: { alignSelf: "stretch", gap: 5 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  legendDot: { width: 7, height: 7, borderRadius: 999 },
  legendName: { color: ob.textSecondary, fontSize: 11, flex: 1 },
  legendPercent: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },

  goalBody: { flexDirection: "row", alignItems: "center", gap: 10 },
  goalNames: { flex: 1, gap: 1 },
  goalName: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "700" },
  goalTarget: { color: ob.textSecondary, fontSize: 12 },
  goalProgressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  goalProgress: { flex: 1 },
  goalPercent: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  goalSaved: { color: ob.textMuted, fontSize: 10.5 },
});
