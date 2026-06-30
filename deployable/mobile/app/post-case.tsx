import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { postCaseRequirement } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const AMBER = "#f59e0b";
const BG = "#0a0f1e";
const CARD = "#111d35";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#e2e8f0";
const MUTED = "#94a3b8";
const DIM = "#475569";
const BLUE = "#3b82f6";

const CASE_TYPES = [
  { id: "Property Dispute", label: "Property", icon: "home" as const },
  { id: "Family Matter", label: "Family", icon: "users" as const },
  { id: "Criminal", label: "Criminal", icon: "shield" as const },
  { id: "Civil", label: "Civil", icon: "book" as const },
  { id: "Corporate", label: "Corporate", icon: "briefcase" as const },
  { id: "Labour", label: "Labour", icon: "user-check" as const },
  { id: "Consumer", label: "Consumer", icon: "shopping-bag" as const },
  { id: "Motor", label: "Motor Accident", icon: "truck" as const },
  { id: "Tax", label: "Tax & GST", icon: "percent" as const },
];

const BUDGET_RANGES = [
  { label: "Under ₹5,000", budget_min: 0, budget_max: 5000 },
  { label: "₹5,000 – ₹15,000", budget_min: 5000, budget_max: 15000 },
  { label: "₹15,000 – ₹50,000", budget_min: 15000, budget_max: 50000 },
  { label: "₹50,000 – ₹1,00,000", budget_min: 50000, budget_max: 100000 },
  { label: "Above ₹1,00,000", budget_min: 100000, budget_max: 0 },
  { label: "Flexible / Discuss", budget_min: 0, budget_max: 0 },
];

export default function PostCaseScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [caseType, setCaseType] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [budgetIdx, setBudgetIdx] = useState(-1);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!user) {
    return (
      <View style={styles.authWall}>
        <View style={styles.authIcon}>
          <Feather name="file-plus" size={36} color={DIM} />
        </View>
        <Text style={styles.authTitle}>Sign In Required</Text>
        <Text style={styles.authSub}>
          Sign in to post a case and get matched with verified lawyers.
        </Text>
        <TouchableOpacity
          style={styles.authBtn}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.authBtnText}>SIGN IN</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!title.trim() || title.trim().length < 5)
      errs.title = "Title must be at least 5 characters.";
    if (!caseType) errs.caseType = "Please select a case type.";
    if (description.length > 2000)
      errs.description = "Description must not exceed 2,000 characters.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const budget =
        budgetIdx >= 0 ? BUDGET_RANGES[budgetIdx] : null;
      await postCaseRequirement({
        title: title.trim(),
        case_type: caseType,
        description,
        location,
        budget_range: budget?.label ?? "",
        budget_min: budget?.budget_min ?? 0,
        budget_max: budget?.budget_max ?? 0,
        is_anonymous: isAnonymous,
      });
      Alert.alert(
        "Case Posted",
        "Your case requirement has been posted. Lawyers will be matched shortly.",
        [{ text: "View My Cases", onPress: () => router.push("/my-cases") }]
      );
      setTitle("");
      setCaseType("");
      setDescription("");
      setLocation("");
      setBudgetIdx(-1);
      setIsAnonymous(false);
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ?? e?.message ?? "Failed to post case.";
      Alert.alert("Error", typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.pageSubtitle}>
          Post your legal matter and AI will match you with verified advocates in your area.
        </Text>

        <View style={styles.section}>
          <Text style={styles.label}>
            Case Title <Text style={styles.req}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, errors.title && styles.inputError]}
            value={title}
            onChangeText={(t) => {
              setTitle(t);
              if (errors.title) setErrors((p) => ({ ...p, title: "" }));
            }}
            placeholder="e.g. Property dispute with neighbour in Banjara Hills"
            placeholderTextColor={DIM}
          />
          {errors.title ? (
            <Text style={styles.fieldErr}>{errors.title}</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>
            Case Type <Text style={styles.req}>*</Text>
          </Text>
          {errors.caseType ? (
            <Text style={[styles.fieldErr, { marginBottom: 8 }]}>
              {errors.caseType}
            </Text>
          ) : null}
          <View style={styles.typeGrid}>
            {CASE_TYPES.map((ct) => {
              const active = caseType === ct.id;
              return (
                <TouchableOpacity
                  key={ct.id}
                  style={[styles.typeBtn, active && styles.typeBtnActive]}
                  onPress={() => {
                    setCaseType(ct.id);
                    if (errors.caseType)
                      setErrors((p) => ({ ...p, caseType: "" }));
                  }}
                  activeOpacity={0.75}
                >
                  <Feather
                    name={ct.icon}
                    size={15}
                    color={active ? BLUE : DIM}
                  />
                  <Text
                    style={[styles.typeLabel, active && styles.typeLabelActive]}
                  >
                    {ct.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Description</Text>
            <Text style={[styles.charCount, description.length > 2000 && styles.charOver]}>
              {description.length} / 2,000
            </Text>
          </View>
          <TextInput
            style={[styles.textarea, errors.description && styles.inputError]}
            value={description}
            onChangeText={(t) => {
              setDescription(t);
              if (errors.description)
                setErrors((p) => ({ ...p, description: "" }));
            }}
            placeholder="Describe your situation in detail. Include relevant dates, parties involved, and the outcome you seek."
            placeholderTextColor={DIM}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          {errors.description ? (
            <Text style={styles.fieldErr}>{errors.description}</Text>
          ) : null}
        </View>

        <View style={styles.row}>
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="City or district"
              placeholderTextColor={DIM}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Budget Range</Text>
          <View style={styles.budgetList}>
            {BUDGET_RANGES.map((b, i) => (
              <TouchableOpacity
                key={b.label}
                style={[styles.budgetBtn, budgetIdx === i && styles.budgetBtnActive]}
                onPress={() => setBudgetIdx(i === budgetIdx ? -1 : i)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.budgetLabel,
                    budgetIdx === i && styles.budgetLabelActive,
                  ]}
                >
                  {b.label}
                </Text>
                {budgetIdx === i && (
                  <Feather name="check" size={14} color={AMBER} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.anonRow}
          onPress={() => setIsAnonymous((v) => !v)}
          activeOpacity={0.75}
        >
          <View style={[styles.checkbox, isAnonymous && styles.checkboxActive]}>
            {isAnonymous && <Feather name="check" size={12} color="#0a0f1e" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.anonTitle}>Post Anonymously</Text>
            <Text style={styles.anonSub}>
              Your name is hidden until you accept a lawyer's proposal.
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#0a0f1e" />
          ) : (
            <>
              <Feather name="send" size={18} color="#0a0f1e" />
              <Text style={styles.submitText}>POST REQUIREMENT</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  pageSubtitle: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
  },
  section: { marginBottom: 20 },
  label: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  req: { color: "#ef4444" },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  charCount: { color: DIM, fontSize: 11 },
  charOver: { color: "#ef4444", fontWeight: "700" },
  input: {
    backgroundColor: CARD,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: TEXT,
    fontSize: 14,
  },
  inputError: { borderColor: "rgba(239,68,68,0.5)" },
  textarea: {
    backgroundColor: CARD,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: TEXT,
    fontSize: 14,
    minHeight: 120,
  },
  fieldErr: { color: "#ef4444", fontSize: 12, marginTop: 4 },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: CARD,
    borderColor: BORDER,
    borderWidth: 1,
  },
  typeBtnActive: {
    borderColor: "rgba(59,130,246,0.5)",
    backgroundColor: "rgba(59,130,246,0.1)",
  },
  typeLabel: { color: DIM, fontSize: 13, fontWeight: "500" },
  typeLabelActive: { color: BLUE, fontWeight: "600" },
  row: { flexDirection: "row", gap: 12 },
  budgetList: { gap: 8 },
  budgetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: CARD,
    borderColor: BORDER,
    borderWidth: 1,
  },
  budgetBtnActive: {
    borderColor: "rgba(245,158,11,0.5)",
    backgroundColor: "rgba(245,158,11,0.08)",
  },
  budgetLabel: { color: MUTED, fontSize: 14 },
  budgetLabelActive: { color: AMBER, fontWeight: "600" },
  anonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: CARD,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderColor: BORDER,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxActive: {
    backgroundColor: AMBER,
    borderColor: AMBER,
  },
  anonTitle: { color: TEXT, fontSize: 14, fontWeight: "600", marginBottom: 3 },
  anonSub: { color: DIM, fontSize: 12, lineHeight: 18 },
  submitBtn: {
    backgroundColor: AMBER,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: {
    color: "#0a0f1e",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 1.5,
  },
  authWall: {
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
  authTitle: {
    color: TEXT,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
  },
  authSub: {
    color: MUTED,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  authBtn: {
    backgroundColor: AMBER,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  authBtnText: {
    color: "#0a0f1e",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 1.5,
  },
});
