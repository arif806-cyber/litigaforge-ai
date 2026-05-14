import React from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, StyleSheet, RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { listCases, type CaseItem } from "@/lib/api";

const AMBER = "#f59e0b";
const BG = "#0a0f1e";
const CARD = "#111d35";
const BORDER = "rgba(255,255,255,0.08)";

export default function CasesScreen() {
  const router = useRouter();
  const { data: cases, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["cases"],
    queryFn: () => listCases(20),
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={AMBER} size="large" />
        <Text style={styles.loadingText}>Loading cases...</Text>
      </View>
    );
  }

  if (!cases || cases.length === 0) {
    return (
      <View style={styles.center}>
        <Feather name="file-text" size={48} color="#1e293b" />
        <Text style={styles.emptyTitle}>No cases yet</Text>
        <Text style={styles.emptyText}>
          Use The Forge to analyse your first case and it will appear here.
        </Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: CaseItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/case/${item.case_id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.caseId}>{item.case_id}</Text>
        <Feather name="chevron-right" size={16} color="#475569" />
      </View>
      <Text style={styles.preview} numberOfLines={2}>{item.prompt_preview}</Text>
      <Text style={styles.timestamp}>
        {new Date(item.timestamp).toLocaleDateString("en-IN", {
          day: "2-digit", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        })}
      </Text>
    </TouchableOpacity>
  );

  return (
    <FlatList
      data={cases}
      keyExtractor={(item) => item.case_id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      style={{ backgroundColor: BG }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={AMBER}
          colors={[AMBER]}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: BG, justifyContent: "center", alignItems: "center", padding: 32 },
  loadingText: { color: "#475569", marginTop: 12, fontSize: 14 },
  emptyTitle: { color: "#e2e8f0", fontSize: 18, fontWeight: "700", marginTop: 20, marginBottom: 8 },
  emptyText: { color: "#475569", fontSize: 14, textAlign: "center", lineHeight: 22 },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: CARD, borderColor: BORDER, borderWidth: 1,
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  caseId: { color: AMBER, fontWeight: "700", fontSize: 13, letterSpacing: 1 },
  preview: { color: "#94a3b8", fontSize: 13, lineHeight: 20, marginBottom: 10 },
  timestamp: { color: "#374151", fontSize: 11, fontFamily: "monospace" },
});
