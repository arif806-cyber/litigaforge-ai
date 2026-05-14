import React from "react";
import {
  View, Text, ScrollView, ActivityIndicator,
  StyleSheet, TouchableOpacity,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { getCase } from "@/lib/api";

const AMBER = "#f59e0b";
const BG = "#0a0f1e";
const CARD = "#111d35";
const BORDER = "rgba(255,255,255,0.08)";

export default function CaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["case", id],
    queryFn: () => getCase(id),
    enabled: !!id,
  });

  const caseData = data as Record<string, unknown> | undefined;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Feather name="arrow-left" size={16} color="#94a3b8" />
        <Text style={styles.backText}>Cases</Text>
      </TouchableOpacity>

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={AMBER} size="large" />
        </View>
      )}

      {isError && (
        <View style={styles.center}>
          <Feather name="alert-triangle" size={32} color="#ef4444" />
          <Text style={styles.errorText}>Case not found</Text>
        </View>
      )}

      {caseData && (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.caseId}>{String(caseData.case_id)}</Text>
          <Text style={styles.timestamp}>
            {new Date(String(caseData.timestamp)).toLocaleDateString("en-IN", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
            })}
          </Text>

          {caseData.prompt && (
            <View style={styles.section}>
              <Text style={styles.label}>CASE FACTS</Text>
              <View style={styles.card}>
                <Text style={styles.body}>{String(caseData.prompt)}</Text>
              </View>
            </View>
          )}

          {Array.isArray(caseData.chains_executed) && caseData.chains_executed.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>CHAINS EXECUTED</Text>
              <View style={styles.chips}>
                {(caseData.chains_executed as string[]).map((c) => (
                  <View key={c} style={styles.chip}>
                    <Text style={styles.chipText}>{c}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {caseData.final_output && (
            <View style={styles.section}>
              <Text style={styles.label}>LEGAL STRATEGY</Text>
              <View style={styles.card}>
                <Text style={styles.body}>{String(caseData.final_output)}</Text>
              </View>
            </View>
          )}

          {Array.isArray(caseData.meta_suggestions) && (caseData.meta_suggestions as string[]).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>RECOMMENDATIONS</Text>
              <View style={styles.card}>
                {(caseData.meta_suggestions as string[]).map((s, i) => (
                  <Text key={i} style={styles.bullet}>• {s}</Text>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, padding: 16, paddingBottom: 8 },
  backText: { color: "#94a3b8", fontSize: 14 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { color: "#ef4444", marginTop: 12, fontSize: 16 },
  scroll: { padding: 16, paddingBottom: 40 },
  caseId: { color: AMBER, fontSize: 20, fontWeight: "800", letterSpacing: 1, marginBottom: 6 },
  timestamp: { color: "#374151", fontSize: 12, marginBottom: 24, fontFamily: "monospace" },
  section: { marginBottom: 24 },
  label: { color: "#475569", fontSize: 10, letterSpacing: 2, fontWeight: "700", marginBottom: 10 },
  card: {
    backgroundColor: CARD, borderColor: BORDER, borderWidth: 1,
    borderRadius: 12, padding: 16,
  },
  body: { color: "#cbd5e1", fontSize: 14, lineHeight: 22 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.3)",
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  chipText: { color: AMBER, fontSize: 11, fontWeight: "600" },
  bullet: { color: "#94a3b8", fontSize: 13, lineHeight: 22 },
});
