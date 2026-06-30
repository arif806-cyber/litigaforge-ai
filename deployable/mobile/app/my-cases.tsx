import React from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, StyleSheet, RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { listMyRequirements, type CaseRequirement } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const AMBER = "#f59e0b";
const BG = "#0a0f1e";
const CARD = "#111d35";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#e2e8f0";
const MUTED = "#94a3b8";
const DIM = "#475569";
const GREEN = "#22c55e";
const BLUE = "#3b82f6";

const STATUS_COLOR: Record<string, string> = {
  open: GREEN,
  matched: AMBER,
  closed: DIM,
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  matched: "Matched",
  closed: "Closed",
};

function CaseCard({
  item,
  onViewMatches,
}: {
  item: CaseRequirement;
  onViewMatches: (id: number) => void;
}) {
  const dot = STATUS_COLOR[item.status] ?? DIM;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.typeBadge}>
          <Feather name="briefcase" size={11} color={AMBER} />
          <Text style={styles.typeBadgeText}>{item.case_type}</Text>
        </View>
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, { backgroundColor: dot }]} />
          <Text style={[styles.statusText, { color: dot }]}>
            {STATUS_LABEL[item.status] ?? item.status}
          </Text>
        </View>
      </View>

      <Text style={styles.caseTitle} numberOfLines={2}>
        {item.title}
      </Text>

      {item.description ? (
        <Text style={styles.caseDesc} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      <View style={styles.metaRow}>
        {item.location ? (
          <View style={styles.metaItem}>
            <Feather name="map-pin" size={12} color={DIM} />
            <Text style={styles.metaText}>{item.location}</Text>
          </View>
        ) : null}
        {item.budget_range ? (
          <View style={styles.metaItem}>
            <Feather name="dollar-sign" size={12} color={DIM} />
            <Text style={styles.metaText}>{item.budget_range}</Text>
          </View>
        ) : null}
        <View style={styles.metaItem}>
          <Feather name="clock" size={12} color={DIM} />
          <Text style={styles.metaText}>
            {new Date(item.created_at).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.matchesBtn}
        onPress={() => onViewMatches(item.id)}
        activeOpacity={0.75}
      >
        <Feather name="users" size={14} color={BLUE} />
        <Text style={styles.matchesBtnText}>View Matches</Text>
        <Feather name="chevron-right" size={14} color={BLUE} />
      </TouchableOpacity>
    </View>
  );
}

export default function MyCasesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const { data: cases, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["my-requirements"],
    queryFn: listMyRequirements,
    enabled: !!user,
  });

  if (!user) {
    return (
      <View style={styles.center}>
        <View style={styles.authIcon}>
          <Feather name="folder" size={36} color={DIM} />
        </View>
        <Text style={styles.emptyTitle}>Sign In Required</Text>
        <Text style={styles.emptyText}>
          Sign in to view your posted case requirements.
        </Text>
        <TouchableOpacity
          style={styles.signInBtn}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.signInBtnText}>SIGN IN</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={AMBER} size="large" />
        <Text style={styles.loadingText}>Loading your cases...</Text>
      </View>
    );
  }

  if (!cases || cases.length === 0) {
    return (
      <View style={styles.center}>
        <View style={styles.authIcon}>
          <Feather name="file-plus" size={36} color={DIM} />
        </View>
        <Text style={styles.emptyTitle}>No Cases Yet</Text>
        <Text style={styles.emptyText}>
          Post your first case requirement and get matched with verified lawyers.
        </Text>
        <TouchableOpacity
          style={styles.signInBtn}
          onPress={() => router.push("/post-case")}
        >
          <Text style={styles.signInBtnText}>POST A CASE</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={cases}
      keyExtractor={(item) => String(item.id)}
      style={{ backgroundColor: BG }}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={AMBER}
          colors={[AMBER]}
        />
      }
      renderItem={({ item }) => (
        <CaseCard
          item={item}
          onViewMatches={(id) =>
            router.push({ pathname: "/matches", params: { caseId: String(id) } })
          }
        />
      )}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>
            {cases.length} case{cases.length !== 1 ? "s" : ""} posted
          </Text>
          <TouchableOpacity
            style={styles.postBtn}
            onPress={() => router.push("/post-case")}
          >
            <Feather name="plus" size={14} color="#0a0f1e" />
            <Text style={styles.postBtnText}>Post New</Text>
          </TouchableOpacity>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  authIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  loadingText: { color: DIM, marginTop: 12, fontSize: 14 },
  emptyTitle: {
    color: TEXT,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    color: MUTED,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  signInBtn: {
    backgroundColor: AMBER,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 28,
  },
  signInBtnText: {
    color: "#0a0f1e",
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 1.5,
  },
  list: { padding: 16, paddingBottom: 32 },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  listHeaderText: { color: DIM, fontSize: 13, fontWeight: "600" },
  postBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: AMBER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  postBtnText: {
    color: "#0a0f1e",
    fontSize: 13,
    fontWeight: "700",
  },
  card: {
    backgroundColor: CARD,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(245,158,11,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeText: { color: AMBER, fontSize: 11, fontWeight: "700" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: "600" },
  caseTitle: { color: TEXT, fontSize: 15, fontWeight: "700", lineHeight: 22 },
  caseDesc: { color: MUTED, fontSize: 13, lineHeight: 20 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { color: DIM, fontSize: 12 },
  matchesBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  matchesBtnText: {
    color: BLUE,
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
});
