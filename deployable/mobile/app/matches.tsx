import React, { useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, StyleSheet, RefreshControl, Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  getClientMatches, findLawyersForCase, acceptMatch, declineMatch,
  type Match,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const AMBER = "#f59e0b";
const BG = "#0a0f1e";
const CARD = "#111d35";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#e2e8f0";
const MUTED = "#94a3b8";
const DIM = "#475569";
const GREEN = "#22c55e";
const RED = "#ef4444";
const VIOLET = "#8b5cf6";

type TabKey = "pending" | "accepted" | "declined";

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? GREEN : score >= 60 ? AMBER : MUTED;
  return (
    <View style={[styles.scoreBadge, { borderColor: color + "44" }]}>
      <Text style={[styles.scoreNum, { color }]}>{score}</Text>
      <Text style={styles.scoreLabel}>/100</Text>
    </View>
  );
}

function MatchCard({
  match,
  onAccept,
  onDecline,
}: {
  match: Match;
  onAccept: (m: Match) => void;
  onDecline: (id: number) => void;
}) {
  const isPending = match.status === "pending";

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.lawyerName}>{match.lawyer_name}</Text>
          {match.district ? (
            <View style={styles.districtRow}>
              <Feather name="map-pin" size={11} color={DIM} />
              <Text style={styles.districtText}>{match.district}</Text>
            </View>
          ) : null}
        </View>
        <ScoreBadge score={match.match_score} />
      </View>

      {match.practice_areas?.length > 0 ? (
        <View style={styles.chips}>
          {match.practice_areas.slice(0, 4).map((area) => (
            <View key={area} style={styles.chip}>
              <Text style={styles.chipText}>{area}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.statsRow}>
        {match.experience_years > 0 ? (
          <View style={styles.statItem}>
            <Feather name="award" size={12} color={DIM} />
            <Text style={styles.statText}>{match.experience_years} yrs exp.</Text>
          </View>
        ) : null}
        {match.hourly_rate > 0 ? (
          <View style={styles.statItem}>
            <Feather name="clock" size={12} color={DIM} />
            <Text style={styles.statText}>₹{match.hourly_rate}/hr</Text>
          </View>
        ) : null}
        {match.rating > 0 ? (
          <View style={styles.statItem}>
            <Feather name="star" size={12} color={AMBER} />
            <Text style={styles.statText}>{match.rating.toFixed(1)}</Text>
          </View>
        ) : null}
      </View>

      {match.ai_explanation ? (
        <View style={styles.explainBox}>
          <Feather name="zap" size={12} color={VIOLET} />
          <Text style={styles.explainText} numberOfLines={3}>
            {match.ai_explanation}
          </Text>
        </View>
      ) : null}

      {match.case_title ? (
        <Text style={styles.caseTitle} numberOfLines={1}>
          Case: {match.case_title}
        </Text>
      ) : null}

      {isPending ? (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => onAccept(match)}
            activeOpacity={0.8}
          >
            <Feather name="user-check" size={15} color="#0a0f1e" />
            <Text style={styles.acceptText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.declineBtn}
            onPress={() => onDecline(match.id)}
            activeOpacity={0.8}
          >
            <Feather name="x" size={15} color={RED} />
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.statusChip}>
          <Feather
            name={match.status === "accepted" ? "check-circle" : "x-circle"}
            size={13}
            color={match.status === "accepted" ? GREEN : DIM}
          />
          <Text
            style={[
              styles.statusChipText,
              { color: match.status === "accepted" ? GREEN : DIM },
            ]}
          >
            {match.status === "accepted" ? "Accepted" : "Declined"}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function MatchesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { caseId } = useLocalSearchParams<{ caseId?: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [findingLawyers, setFindingLawyers] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["client-matches"],
    queryFn: getClientMatches,
    enabled: !!user,
  });

  const matches: Match[] = data?.matches ?? [];

  const acceptMutation = useMutation({
    mutationFn: (id: number) => acceptMatch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-matches"] });
      refetch();
    },
    onError: (e: any) => {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail ?? e?.message ?? "Failed to accept match.";
      if (status === 402) {
        Alert.alert(
          "Connection Fee Required",
          "A one-time platform connection fee is required before accepting this proposal. Please complete payment via the web app to proceed.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert("Error", typeof detail === "string" ? detail : JSON.stringify(detail));
      }
    },
  });

  const declineMutation = useMutation({
    mutationFn: (id: number) => declineMatch(id),
    onSuccess: () => refetch(),
  });

  const handleFindLawyers = async () => {
    if (!caseId) return;
    setFindingLawyers(true);
    try {
      await findLawyersForCase(Number(caseId));
      refetch();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail ?? "Failed to find lawyers.");
    } finally {
      setFindingLawyers(false);
    }
  };

  const handleAccept = (match: Match) => {
    Alert.alert(
      "Accept Match",
      `Accept ${match.lawyer_name} for this case?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: () => acceptMutation.mutate(match.id),
        },
      ]
    );
  };

  const handleDecline = (id: number) => {
    Alert.alert(
      "Decline Match",
      "Are you sure you want to decline this proposal?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: () => declineMutation.mutate(id),
        },
      ]
    );
  };

  if (!user) {
    return (
      <View style={styles.center}>
        <View style={styles.authIcon}>
          <Feather name="users" size={36} color={DIM} />
        </View>
        <Text style={styles.emptyTitle}>Sign In Required</Text>
        <Text style={styles.emptyText}>
          Sign in to view your AI-matched lawyer proposals.
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
        <Text style={styles.loadingText}>Loading matches...</Text>
      </View>
    );
  }

  const filtered = matches.filter((m) => m.status === activeTab);

  const tabs: TabKey[] = ["pending", "accepted", "declined"];

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {caseId ? (
        <View style={styles.findBar}>
          <TouchableOpacity
            style={[styles.findBtn, findingLawyers && styles.findBtnDisabled]}
            onPress={handleFindLawyers}
            disabled={findingLawyers}
            activeOpacity={0.8}
          >
            {findingLawyers ? (
              <ActivityIndicator color="#0a0f1e" size="small" />
            ) : (
              <Feather name="zap" size={15} color="#0a0f1e" />
            )}
            <Text style={styles.findBtnText}>
              {findingLawyers ? "Finding..." : `Find Lawyers — Case #${caseId}`}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const count = matches.filter((m) => m.status === tab).length;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === tab && styles.tabLabelActive,
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
              {count > 0 ? (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{count}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        style={{ flex: 1 }}
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
          <MatchCard
            match={item}
            onAccept={handleAccept}
            onDecline={handleDecline}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Feather name="users" size={40} color={CARD} />
            <Text style={styles.emptyTitle}>
              {activeTab === "pending"
                ? "No pending matches"
                : `No ${activeTab} matches`}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === "pending"
                ? "Go to My Cases and tap \"View Matches\" to find lawyers for your case."
                : ""}
            </Text>
          </View>
        }
      />
    </View>
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
    fontSize: 18,
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
  findBar: {
    padding: 12,
    paddingBottom: 0,
  },
  findBtn: {
    backgroundColor: AMBER,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  findBtnDisabled: { opacity: 0.6 },
  findBtnText: {
    color: "#0a0f1e",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: CARD,
    borderColor: BORDER,
    borderWidth: 1,
    gap: 5,
  },
  tabItemActive: {
    borderColor: AMBER + "55",
    backgroundColor: "rgba(245,158,11,0.1)",
  },
  tabLabel: {
    color: DIM,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  tabLabelActive: { color: AMBER },
  tabBadge: {
    backgroundColor: AMBER,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tabBadgeText: { color: "#0a0f1e", fontSize: 10, fontWeight: "800" },
  list: { padding: 12, paddingBottom: 32 },
  emptyBox: {
    alignItems: "center",
    padding: 48,
    gap: 12,
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
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  lawyerName: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  districtRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  districtText: { color: DIM, fontSize: 12 },
  scoreBadge: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    minWidth: 54,
  },
  scoreNum: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 22,
  },
  scoreLabel: { color: DIM, fontSize: 10, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    backgroundColor: "rgba(245,158,11,0.1)",
    borderColor: "rgba(245,158,11,0.25)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  chipText: { color: AMBER, fontSize: 11, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 14 },
  statItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  statText: { color: MUTED, fontSize: 12 },
  explainBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(139,92,246,0.06)",
    borderColor: "rgba(139,92,246,0.2)",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  explainText: { color: MUTED, fontSize: 12, lineHeight: 18, flex: 1 },
  caseTitle: { color: DIM, fontSize: 12 },
  actionRow: { flexDirection: "row", gap: 10 },
  acceptBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: AMBER,
    borderRadius: 10,
    paddingVertical: 11,
  },
  acceptText: {
    color: "#0a0f1e",
    fontWeight: "700",
    fontSize: 13,
  },
  declineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderColor: "rgba(239,68,68,0.4)",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
  },
  declineText: { color: RED, fontWeight: "700", fontSize: 13 },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusChipText: { fontSize: 13, fontWeight: "600" },
});
