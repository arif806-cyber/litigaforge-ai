import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";

const AMBER = "#f59e0b";
const BG = "#0a0f1e";
const CARD = "#111d35";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#e2e8f0";
const MUTED = "#94a3b8";
const DIM = "#475569";
const ERROR = "#ef4444";

export default function LoginScreen() {
  const router = useRouter();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setError("Full name is required.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await register(name.trim(), email.trim(), password);
      }
      router.back();
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ??
        e?.message ??
        "Something went wrong. Please try again.";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
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
        <View style={styles.logoRow}>
          <View style={styles.logoIcon}>
            <Feather name="shield" size={28} color={AMBER} />
          </View>
          <Text style={styles.logoText}>LITIGAFORGE AI</Text>
        </View>

        <Text style={styles.title}>
          {mode === "login" ? "Sign In" : "Create Account"}
        </Text>
        <Text style={styles.subtitle}>
          {mode === "login"
            ? "Access your matches and case management."
            : "Join LitigaForge to post cases and find lawyers."}
        </Text>

        <View style={styles.card}>
          {mode === "register" && (
            <View style={styles.field}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Ramesh Kumar"
                placeholderTextColor={DIM}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={DIM}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.pwRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={DIM}
                secureTextEntry={!showPw}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPw((v) => !v)}
              >
                <Feather
                  name={showPw ? "eye-off" : "eye"}
                  size={18}
                  color={DIM}
                />
              </TouchableOpacity>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color={ERROR} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#0a0f1e" />
            ) : (
              <Text style={styles.btnText}>
                {mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => {
            setError("");
            setMode((m) => (m === "login" ? "register" : "login"));
          }}
          style={styles.switchRow}
        >
          <Text style={styles.switchText}>
            {mode === "login"
              ? "Don't have an account? "
              : "Already have an account? "}
            <Text style={styles.switchLink}>
              {mode === "login" ? "Register" : "Sign In"}
            </Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 24, justifyContent: "center" },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 32,
    justifyContent: "center",
  },
  logoIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(245,158,11,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: AMBER,
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 3,
  },
  title: {
    color: TEXT,
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    color: MUTED,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  card: {
    backgroundColor: CARD,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 0,
  },
  field: { marginBottom: 16 },
  label: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: TEXT,
    fontSize: 14,
  },
  pwRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyeBtn: { padding: 12 },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderColor: "rgba(239,68,68,0.25)",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: ERROR, fontSize: 13, lineHeight: 18, flex: 1 },
  btn: {
    backgroundColor: AMBER,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    color: "#0a0f1e",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 1.5,
  },
  switchRow: { marginTop: 24, alignItems: "center" },
  switchText: { color: MUTED, fontSize: 14 },
  switchLink: { color: AMBER, fontWeight: "700" },
});
