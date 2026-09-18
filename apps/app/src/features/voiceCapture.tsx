import { radii, spacing, typography } from "@money-dock/design-tokens";
import type { Account, Category, CommandDraft } from "@money-dock/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type ReactNode } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextStyle,
} from "react-native";

import { apiClient } from "../api/client";
import { useTheme } from "../theme/useTheme";
import { Text } from "../ui/Text";
import { PressableScale, Segmented } from "../ui/primitives";
import { generateClientId } from "../utils/uuid";

/**
 * Parse + save, shared by the home screen's press-and-hold mic and the dedicated /voice
 * screen (typed commands, examples, browsers with no speech API). Both need exactly the
 * same draft/save behaviour — only how the draft gets its first `value` differs — so this
 * is the one place that logic lives; each caller supplies its own per-call `onSuccess`.
 */
export function useVoiceCapture() {
  const queryClient = useQueryClient();

  const parse = useMutation({
    mutationFn: ({ value, source }: { value: string; source: "voice" | "text" }) =>
      apiClient.commands.parse(value, source),
  });

  const save = useMutation({
    mutationFn: (confirmed: CommandDraft) => {
      if (!confirmed.accountId) throw new Error("Сначала добавьте счёт");
      return apiClient.transactions.create({
        type: confirmed.type,
        accountId: confirmed.accountId,
        categoryId: confirmed.categoryId ?? undefined,
        amountMinor: confirmed.amountMinor,
        currency: confirmed.currency,
        occurredAt: confirmed.occurredAt,
        clientId: generateClientId(),
      });
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      ]),
  });

  return { parse, save };
}

const DAY_MS = 86_400_000;

function daysAgoOf(iso: string): number {
  const day = new Date(iso);
  const today = new Date();
  day.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - day.getTime()) / DAY_MS);
}

/** Keeps the parsed time of day so "yesterday" stays yesterday in every timezone. */
function shiftToDaysAgo(iso: string, daysAgo: number): string {
  const target = new Date();
  target.setDate(target.getDate() - daysAgo);
  const time = new Date(iso);
  target.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), 0);
  return target.toISOString();
}

function amountToText(amountMinor: number): string {
  const major = amountMinor / 100;
  return Number.isInteger(major) ? String(major) : major.toFixed(2).replace(/0+$/, "");
}

function textToAmountMinor(text: string): number | null {
  const value = Number(text.replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
}

const DATE_CHIPS = [
  { daysAgo: 0, label: "Сегодня" },
  { daysAgo: 1, label: "Вчера" },
  { daysAgo: 2, label: "Позавчера" },
];

/**
 * The recognized draft — figures, category, account, date — every one of them editable
 * in place, with Save/Cancel. Editing is *controlled*: the caller owns the draft and gets
 * every change through `onChange`, so what it saves is exactly what's on screen. No
 * outer card or sheet chrome here, so it drops equally well into a `<Card>` (the /voice
 * screen) or a `<BottomSheet>` (the home screen's press-and-hold flow).
 */
export function DraftSummary({
  draft,
  onChange,
  saving,
  onDiscard,
  onSave,
}: {
  draft: CommandDraft;
  onChange: (draft: CommandDraft) => void;
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const theme = useTheme();
  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiClient.accounts.list(),
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiClient.categories.list(),
  });

  // The draft is the source of truth for the amount except while the field has focus —
  // otherwise a half-typed "12." would be reformatted from under the user's cursor.
  const [amountEditing, setAmountEditing] = useState<string | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const visibleCategories = (categories ?? []).filter((c) => c.type === draft.type || c.type === "both");
  const currentDaysAgo = daysAgoOf(draft.occurredAt);
  const customDate = !DATE_CHIPS.some((chip) => chip.daysAgo === currentDaysAgo);

  const setType = (type: CommandDraft["type"]) => {
    if (type === draft.type) return;
    onChange({ ...draft, type, categoryId: null, categoryName: null });
  };
  const setAccount = (account: Account) =>
    onChange({
      ...draft,
      accountId: account.id,
      accountName: account.name,
      currency: account.currency,
    });
  const setCategory = (category: Category) =>
    onChange({
      ...draft,
      categoryId: category.id === draft.categoryId ? null : category.id,
      categoryName: category.id === draft.categoryId ? null : category.name,
    });
  const setDaysAgo = (daysAgo: number) =>
    onChange({ ...draft, occurredAt: shiftToDaysAgo(draft.occurredAt, daysAgo) });

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: theme.textSecondary }]}>Я распознал</Text>

      <Segmented<CommandDraft["type"]>
        value={draft.type}
        onChange={setType}
        options={[
          { value: "expense", label: "Расход" },
          { value: "income", label: "Доход" },
        ]}
      />

      <View style={styles.amountRow}>
        <TextInput
          value={amountEditing ?? amountToText(draft.amountMinor)}
          // An <input> ignores its content for sizing, so the width tracks the digits —
          // otherwise the field fills the row and the currency sign drifts to the edge.
          style={[
            styles.amountInput,
            noFocusRing,
            {
              color: theme.textPrimary,
              width: 8 + 24 * Math.max(2, (amountEditing ?? amountToText(draft.amountMinor)).length),
            },
          ]}
          onFocus={() => setAmountEditing(amountToText(draft.amountMinor))}
          onBlur={() => setAmountEditing(null)}
          onChangeText={(text) => {
            setAmountEditing(text);
            const amountMinor = textToAmountMinor(text);
            if (amountMinor !== null) onChange({ ...draft, amountMinor });
          }}
          keyboardType="decimal-pad"
          inputMode="decimal"
          selectTextOnFocus
          accessibilityLabel="Сумма"
        />
        <Text style={[styles.currency, { color: theme.textTertiary }]}>
          {draft.currency === "RUB" ? "₽" : draft.currency}
        </Text>
      </View>

      <Field label="Категория" hint={draft.categoryName ? undefined : "Не определена — выберите"}>
        <ChipRow>
          {visibleCategories.map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              active={category.id === draft.categoryId}
              onPress={() => setCategory(category)}
            />
          ))}
        </ChipRow>
      </Field>

      <Field label="Счёт" hint={accounts?.length === 0 ? "Сначала добавьте счёт" : undefined}>
        <ChipRow>
          {(accounts ?? []).map((account) => (
            <Chip
              key={account.id}
              label={account.name}
              active={account.id === draft.accountId}
              onPress={() => setAccount(account)}
            />
          ))}
        </ChipRow>
      </Field>

      <Field label="Дата">
        <ChipRow>
          {DATE_CHIPS.map((chip) => (
            <Chip
              key={chip.daysAgo}
              label={chip.label}
              active={chip.daysAgo === currentDaysAgo}
              onPress={() => setDaysAgo(chip.daysAgo)}
            />
          ))}
          {Platform.OS === "web" ? (
            <Chip
              label={
                customDate
                  ? new Date(draft.occurredAt).toLocaleDateString("ru-RU")
                  : "Другая дата"
              }
              active={customDate}
              onPress={() => {
                const input = dateInputRef.current;
                if (!input) return;
                if (typeof input.showPicker === "function") input.showPicker();
                else input.click();
              }}
            />
          ) : null}
        </ChipRow>
        {Platform.OS === "web" ? (
          <input
            ref={dateInputRef}
            type="date"
            value={draft.occurredAt.slice(0, 10)}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(event) => {
              const picked = new Date(`${event.target.value}T12:00:00`);
              if (!Number.isNaN(picked.getTime())) setDaysAgo(daysAgoOf(picked.toISOString()));
            }}
            style={hiddenDateInputStyle}
          />
        ) : null}
      </Field>

      <Text style={[styles.confidence, { color: theme.textTertiary }]}>
        Уверенность {Math.round(draft.confidence * 100)}% · распознано:{" "}
        {draft.explanation.join(", ")}
      </Text>

      {/* PressableScale styles an inner Animated.View, so the 1:2 split lives on wrappers. */}
      <View style={styles.actions}>
        <View style={styles.secondarySlot}>
          <PressableScale
            onPress={onDiscard}
            style={StyleSheet.flatten([styles.secondary, { borderColor: theme.border }])}
          >
            <Text style={[styles.actionText, { color: theme.textPrimary }]}>Отмена</Text>
          </PressableScale>
        </View>
        <View style={styles.primarySlot}>
          <PressableScale
            onPress={onSave}
            style={StyleSheet.flatten([styles.primary, { backgroundColor: theme.accent }])}
          >
            <Text style={[styles.actionText, { color: theme.onAccent }]}>
              {saving ? "Сохраняю…" : "Сохранить"}
            </Text>
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
        {hint ? <Text style={[styles.fieldHint, { color: theme.textTertiary }]}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** One horizontal, scrollable line per field keeps the card the same height however
 * many categories or accounts the user has — a wrapping grid would push Save off a
 * phone screen inside the bottom sheet. */
function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.chipRow}
    >
      {children}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, { backgroundColor: active ? theme.accent : theme.surfaceSunken }]}
    >
      <Text
        style={[styles.chipText, { color: active ? theme.onAccent : theme.textPrimary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Chrome's focus-visible ring on a bare number reads as a stray box; `outlineWidth: 0`
// alone leaves `outline-style: auto` in charge. Web-only CSS, so it isn't in RN's types.
const noFocusRing = Platform.select<TextStyle>({
  web: { outlineStyle: "none" } as unknown as TextStyle,
  default: {},
});

// Off-screen rather than display:none — a hidden input can't open its picker.
const hiddenDateInputStyle = {
  position: "absolute" as const,
  width: 1,
  height: 1,
  opacity: 0,
  pointerEvents: "none" as const,
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  title: { ...typography.overline, textTransform: "uppercase" },

  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: spacing.xs,
  },
  amountInput: {
    ...typography.hero,
    fontSize: 40,
    lineHeight: 48,
    fontWeight: "700",
    textAlign: "right",
    padding: 0,
  },
  currency: { ...typography.display, fontWeight: "500" },

  field: { gap: spacing.xs },
  fieldHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  fieldLabel: typography.callout,
  fieldHint: typography.caption,
  chipRow: { flexDirection: "row", gap: spacing.xs, paddingVertical: 2 },
  chip: { borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chipText: { ...typography.callout, fontWeight: "600" },

  confidence: { ...typography.caption, lineHeight: 17 },
  actions: { flexDirection: "row", gap: spacing.sm },
  secondarySlot: { flex: 1 },
  primarySlot: { flex: 2 },
  secondary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  primary: { borderRadius: radii.md, paddingVertical: spacing.md, alignItems: "center" },
  actionText: { ...typography.callout, fontWeight: "600" },
});
