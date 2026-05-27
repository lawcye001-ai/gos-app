import { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { coaches, getCoach, type CoachId } from "@/data/coaches";
import { useHistory, type HistoryItem } from "@/hooks/useHistory";
import type { Decision } from "@/lib/decisions";
import type { Action } from "@/lib/actions";
import { colors, radius, spacing } from "@/theme/colors";

const DAY_MS = 24 * 60 * 60 * 1000;

type FilterValue = "all" | CoachId;

type HeaderRow = { kind: "header"; id: string; label: string };
type ListRow = HistoryItem | HeaderRow;

function dayStart(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayLabel(ts: number, now: number): string {
  const days = Math.round((dayStart(now) - dayStart(ts)) / DAY_MS);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  return `${days}일 전`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RecordsScreen() {
  const { items, loading } = useHistory();
  const [filter, setFilter] = useState<FilterValue>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => i.coachId === filter);
  }, [items, filter]);

  const rows = useMemo<ListRow[]>(() => {
    if (filtered.length === 0) return [];
    const now = Date.now();
    const out: ListRow[] = [];
    let lastLabel: string | null = null;
    for (const item of filtered) {
      const label = dayLabel(item.createdAt, now);
      if (label !== lastLabel) {
        out.push({
          kind: "header",
          id: `h:${label}:${item.createdAt}`,
          label,
        });
        lastLabel = label;
      }
      out.push(item);
    }
    return out;
  }, [filtered]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>기록</Text>
      </View>

      <FilterRow value={filter} onChange={setFilter} />

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.id}
          renderItem={({ item }) => {
            if (item.kind === "header") return <DayHeader label={item.label} />;
            if (item.kind === "decision") return <DecisionRow item={item} />;
            return <ActionRow item={item} />;
          }}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

function FilterRow({
  value,
  onChange,
}: {
  value: FilterValue;
  onChange: (v: FilterValue) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterScroll}
      contentContainerStyle={styles.filterRow}
    >
      <FilterChip
        label="전체"
        active={value === "all"}
        activeColor={colors.accent}
        onPress={() => onChange("all")}
      />
      {coaches.map((c) => (
        <FilterChip
          key={c.id}
          label={c.name}
          active={value === c.id}
          activeColor={c.primary}
          onPress={() => onChange(c.id)}
        />
      ))}
    </ScrollView>
  );
}

function FilterChip({
  label,
  active,
  activeColor,
  onPress,
}: {
  label: string;
  active: boolean;
  activeColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active
          ? { backgroundColor: activeColor + "22", borderColor: activeColor }
          : { borderColor: colors.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? activeColor : colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Ionicons
          name="document-text-outline"
          size={32}
          color={colors.textDim}
        />
      </View>
      <Text style={styles.emptyText}>
        아직 기록이 없어. 채팅에서 결정이나 행동을 시작해봐.
      </Text>
    </View>
  );
}

function DayHeader({ label }: { label: string }) {
  return (
    <View style={styles.dayHeader}>
      <Text style={styles.dayHeaderText}>{label}</Text>
    </View>
  );
}

const CARD_COLORS: Record<Decision["card"], string> = {
  GO: colors.success,
  HOLD: colors.warning,
  STOP: colors.danger,
};

function DecisionRow({
  item,
}: {
  item: Extract<HistoryItem, { kind: "decision" }>;
}) {
  const accent = CARD_COLORS[item.decision.card];
  const coach = getCoach(item.coachId);
  return (
    <View style={styles.itemRow}>
      <View style={[styles.colorBar, { backgroundColor: accent }]} />
      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text style={[styles.cardLabel, { color: accent }]}>
            {item.decision.card}
          </Text>
          <StatusBadge status={item.decision.status} />
        </View>
        <Text style={styles.topic} numberOfLines={2}>
          {item.decision.topic}
        </Text>
        <Text style={styles.reason} numberOfLines={1}>
          {item.decision.reason}
        </Text>
      </View>
      <View style={styles.metaCol}>
        <Text style={[styles.coachName, { color: coach.primary }]}>
          {coach.name}
        </Text>
        <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
      </View>
    </View>
  );
}

function StatusBadge({ status }: { status: Decision["status"] }) {
  const color =
    status === "active"
      ? colors.accent
      : status === "resolved"
        ? colors.success
        : colors.textDim;
  return (
    <View style={[styles.badge, { borderColor: color + "66" }]}>
      <Text style={[styles.badgeText, { color }]}>{status}</Text>
    </View>
  );
}

const ACTION_ICONS: Record<
  Action["status"],
  { name: keyof typeof Ionicons.glyphMap; color: string }
> = {
  pending: { name: "ellipse-outline", color: colors.textDim },
  in_progress: { name: "time", color: colors.warning },
  done: { name: "checkmark-circle", color: colors.success },
  abandoned: { name: "close-circle", color: colors.textDim },
};

function ActionRow({
  item,
}: {
  item: Extract<HistoryItem, { kind: "action" }>;
}) {
  const icon = ACTION_ICONS[item.action.status];
  const coach = getCoach(item.coachId);
  return (
    <View style={styles.itemRow}>
      <View style={styles.actionIconWrap}>
        <Ionicons name={icon.name} size={22} color={icon.color} />
      </View>
      <View style={styles.body}>
        <Text style={styles.actionText} numberOfLines={2}>
          {item.action.text}
        </Text>
      </View>
      <View style={styles.metaCol}>
        <Text style={[styles.coachName, { color: coach.primary }]}>
          {coach.name}
        </Text>
        <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filterRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: spacing.md,
    height: 32,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.bgCard,
    alignSelf: "center",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  dayHeader: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  dayHeaderText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  itemRow: {
    flexDirection: "row",
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  colorBar: {
    width: 4,
  },
  actionIconWrap: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
  },
  body: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: 2,
  },
  topLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 2,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  topic: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
  },
  reason: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  actionText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
  },
  metaCol: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 2,
  },
  coachName: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  time: {
    color: colors.textDim,
    fontSize: 10,
  },
});
