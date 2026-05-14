import React from "react";
import {
  View, Text, FlatList, ActivityIndicator, StyleSheet,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { listChains, type ChainItem } from "@/lib/api";

const AMBER = "#f59e0b";
const BG = "#0a0f1e";
const CARD = "#111d35";
const BORDER = "rgba(255,255,255,0.08)";

const CHAIN_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  GSTIN:        { text: "#60a5fa", bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.3)"  },
  PAN:          { text: "#a78bfa", bg: "rgba(139,92,246,0.1)",  border: "rgba(139,92,246,0.3)"  },
  DigiLocker:   { text: "#22d3ee", bg: "rgba(6,182,212,0.1)",   border: "rgba(6,182,212,0.3)"   },
  eCourts:      { text: AMBER,     bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)"  },
  VAHAN:        { text: "#4ade80", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.3)"   },
  SARATHI:      { text: "#2dd4bf", bg: "rgba(20,184,166,0.1)",  border: "rgba(20,184,166,0.3)"  },
  BPCL_LPG:     { text: "#fb923c", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.3)"  },
  MERIPEHCHAAN: { text: "#f472b6", bg: "rgba(236,72,153,0.1)",  border: "rgba(236,72,153,0.3)"  },
  MEE_SEVA_TG:  { text: "#818cf8", bg: "rgba(99,102,241,0.1)",  border: "rgba(99,102,241,0.3)"  },
  TRANSPORT_TS: { text: "#34d399", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.3)"  },
};

export default function ChainsScreen() {
  const { data: chains, isLoading } = useQuery({
    queryKey: ["chains"],
    queryFn: listChains,
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={AMBER} size="large" />
      </View>
    );
  }

  const renderItem = ({ item, index }: { item: ChainItem; index: number }) => {
    const colors = CHAIN_COLORS[item.name] ?? { text: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.3)" };
    return (
      <View style={[styles.card, { borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={[styles.badgeText, { color: colors.text }]}>{item.name}</Text>
          </View>
          <Text style={styles.indexNum}>#{String(index + 1).padStart(2, "0")}</Text>
        </View>
        <Text style={styles.description}>{item.description}</Text>
        <View style={styles.statusRow}>
          <Feather name="check-circle" size={12} color="#22c55e" />
          <Text style={styles.statusText}>Active</Text>
        </View>
      </View>
    );
  };

  return (
    <FlatList
      data={chains ?? []}
      keyExtractor={(item) => item.name}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      style={{ backgroundColor: BG }}
      ListHeaderComponent={
        <Text style={styles.subtitle}>
          The nervous system of LitigaForge. These independent API chains are dynamically
          orchestrated based on extracted entities to build comprehensive intelligence.
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: BG, justifyContent: "center", alignItems: "center" },
  list: { padding: 16, paddingBottom: 32 },
  subtitle: { color: "#64748b", fontSize: 13, lineHeight: 20, marginBottom: 20 },
  card: {
    backgroundColor: CARD, borderWidth: 1,
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  badge: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  badgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  indexNum: { color: "#1e293b", fontSize: 12, fontFamily: "monospace" },
  description: { color: "#94a3b8", fontSize: 13, lineHeight: 20, marginBottom: 12 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusText: { color: "#22c55e", fontSize: 11, fontWeight: "600" },
});
