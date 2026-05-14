import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, StyleSheet, KeyboardAvoidingView, Platform,
} from "react-native";
import { useMutation } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { forgeCase, type ForgeResult } from "@/lib/api";

const SUGGESTED = [
  "My client Ramesh Kumar with PAN ABCDE1234F and GSTIN 36ABCDE1234F1Z5 has a property dispute in Hyderabad. Vehicle TS09EA1234 involved.",
  "Client Lakshmi Devi, DL No. TS0920230001234, met with an accident in Vijayawada. Need RC and DL verification.",
  "GST fraud case — GSTIN 29AABCU9603R1ZM and PAN AABCU9603R, case filed at City Civil Court Hyderabad.",
];

const AMBER = "#f59e0b";
const BG = "#0a0f1e";
const CARD = "#111d35";
const BORDER = "rgba(255,255,255,0.08)";

export default function ForgeScreen() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<ForgeResult | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: forgeCase,
    onSuccess: (data) => setResult(data),
    onError: (err: Error) => Alert.alert("Forge Failed", err.message),
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>
          Input your case facts. LitigaForge will extract entities, execute government API chains,
          and synthesize a Supreme Court-grade legal strategy.
        </Text>

        <TextInput
          style={styles.textarea}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Describe the case facts here. Include PAN, GSTIN, vehicle numbers, or names..."
          placeholderTextColor="#374151"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        <Text style={styles.sectionLabel}>SUGGESTED INPUTS</Text>
        {SUGGESTED.map((s, i) => (
          <TouchableOpacity key={i} style={styles.suggestion} onPress={() => setPrompt(s)}>
            <Text style={styles.suggestionText}>{s}</Text>
            <View style={styles.suggestionBadge}>
              <Text style={styles.suggestionNum}>{i + 1}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.forgeBtn, isPending && styles.forgeBtnDisabled]}
          onPress={() => prompt.trim() && mutate(prompt)}
          disabled={isPending || !prompt.trim()}
          activeOpacity={0.8}
        >
          {isPending ? (
            <ActivityIndicator color="#0a0f1e" />
          ) : (
            <>
              <Feather name="zap" size={18} color="#0a0f1e" />
              <Text style={styles.forgeBtnText}>INITIATE FORGE</Text>
            </>
          )}
        </TouchableOpacity>

        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Case {result.case_id}</Text>
            <Text style={styles.resultLabel}>CHAINS EXECUTED</Text>
            <View style={styles.chips}>
              {result.chains_executed.map((c) => (
                <View key={c} style={styles.chip}>
                  <Text style={styles.chipText}>{c}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.resultLabel}>STRATEGY</Text>
            <Text style={styles.resultBody}>{result.final_output}</Text>
            {result.meta_suggestions.length > 0 && (
              <>
                <Text style={styles.resultLabel}>RECOMMENDATIONS</Text>
                {result.meta_suggestions.map((s, i) => (
                  <Text key={i} style={styles.bullet}>• {s}</Text>
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  subtitle: { color: "#94a3b8", fontSize: 14, lineHeight: 22, marginBottom: 20 },
  textarea: {
    backgroundColor: CARD, borderColor: BORDER, borderWidth: 1,
    borderRadius: 12, padding: 16, color: "#e2e8f0", fontSize: 14,
    lineHeight: 22, minHeight: 140, marginBottom: 24,
  },
  sectionLabel: {
    color: "#475569", fontSize: 10, letterSpacing: 2,
    fontWeight: "700", marginBottom: 12,
  },
  suggestion: {
    backgroundColor: CARD, borderColor: BORDER, borderWidth: 1,
    borderRadius: 12, padding: 16, marginBottom: 10,
    flexDirection: "row", alignItems: "flex-start",
  },
  suggestionText: { color: "#94a3b8", fontSize: 13, lineHeight: 20, flex: 1 },
  suggestionBadge: {
    backgroundColor: "rgba(245,158,11,0.1)", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4, marginLeft: 10,
  },
  suggestionNum: { color: AMBER, fontSize: 11, fontWeight: "700" },
  forgeBtn: {
    backgroundColor: AMBER, borderRadius: 12, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, marginTop: 24,
  },
  forgeBtnDisabled: { opacity: 0.5 },
  forgeBtnText: { color: "#0a0f1e", fontWeight: "800", fontSize: 14, letterSpacing: 1.5 },
  resultCard: {
    backgroundColor: CARD, borderColor: BORDER, borderWidth: 1,
    borderRadius: 16, padding: 20, marginTop: 24,
  },
  resultTitle: { color: AMBER, fontWeight: "700", fontSize: 16, marginBottom: 16 },
  resultLabel: { color: "#475569", fontSize: 10, letterSpacing: 2, fontWeight: "700", marginBottom: 8, marginTop: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.3)",
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  chipText: { color: AMBER, fontSize: 11, fontWeight: "600" },
  resultBody: { color: "#cbd5e1", fontSize: 14, lineHeight: 22 },
  bullet: { color: "#94a3b8", fontSize: 13, lineHeight: 22 },
});
