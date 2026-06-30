import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { sendLegalChat } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const AMBER = "#f59e0b";
const BG = "#0a0f1e";
const CARD = "#111d35";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#e2e8f0";
const MUTED = "#94a3b8";
const DIM = "#475569";
const VIOLET = "#8b5cf6";

interface Message {
  id: number;
  role: "user" | "ai";
  content: string;
}

const TEMPLATES = [
  {
    id: "legal_notice",
    label: "Legal Notice",
    icon: "file-text" as const,
    prompt:
      "Draft a formal legal notice for [describe issue]. Include all sections required under applicable Indian law.",
  },
  {
    id: "agreement",
    label: "Agreement Draft",
    icon: "edit-3" as const,
    prompt:
      "Draft a [rental/partnership/employment] agreement with standard clauses that are valid in India.",
  },
  {
    id: "petition",
    label: "Court Petition",
    icon: "book" as const,
    prompt:
      "Draft a petition for a [civil/criminal/writ] matter for filing in the appropriate court in India.",
  },
  {
    id: "reply",
    label: "Reply to Notice",
    icon: "message-circle" as const,
    prompt:
      "Draft a reply to a legal notice received regarding [matter]. Be firm but legally sound under Indian law.",
  },
];

const WELCOME =
  "I am LitigaForge AI, your legal drafting assistant. I can help you draft legal notices, agreements, petitions, and replies — tailored to Indian law.\n\nHow can I help you today?";

function TypingDots() {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const iv = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 400);
    return () => clearInterval(iv);
  }, []);
  return (
    <View style={styles.typingBubble}>
      <View style={styles.aiBubbleIcon}>
        <Feather name="zap" size={12} color={VIOLET} />
      </View>
      <View style={[styles.bubble, styles.aiBubble]}>
        <Text style={[styles.bubbleText, { color: MUTED }]}>
          Thinking{dots}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: "ai", content: WELCOME },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  useEffect(scrollToBottom, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;
    const userMsg: Message = { id: Date.now(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    try {
      const res = await sendLegalChat(trimmed, "", "IN");
      const aiMsg: Message = {
        id: Date.now() + 1,
        role: "ai",
        content: res.reply || "Sorry, I could not generate a response.",
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.message ?? "";
      const errMsg: Message = {
        id: Date.now() + 1,
        role: "ai",
        content: detail || "I apologise, but I am unable to respond right now. Please try again.",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const clearChat = () => {
    setMessages([{ id: 0, role: "ai", content: WELCOME }]);
  };

  if (!user) {
    return (
      <View style={styles.authWall}>
        <View style={styles.authIcon}>
          <Feather name="message-circle" size={36} color={DIM} />
        </View>
        <Text style={styles.authTitle}>Sign In Required</Text>
        <Text style={styles.authSub}>
          Sign in to access the AI legal drafting assistant.
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.chatHeader}>
        <View style={styles.chatHeaderLeft}>
          <View style={styles.botIcon}>
            <Feather name="zap" size={14} color={VIOLET} />
          </View>
          <View>
            <Text style={styles.chatHeaderTitle}>Legal AI Chat</Text>
            <Text style={styles.chatHeaderSub}>Indian law · Always available</Text>
          </View>
        </View>
        <TouchableOpacity onPress={clearChat} style={styles.clearBtn}>
          <Feather name="trash-2" size={16} color={DIM} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[
              styles.msgRow,
              msg.role === "user" ? styles.msgRowUser : styles.msgRowAI,
            ]}
          >
            {msg.role === "ai" && (
              <View style={styles.aiBubbleIcon}>
                <Feather name="zap" size={12} color={VIOLET} />
              </View>
            )}
            <View
              style={[
                styles.bubble,
                msg.role === "user" ? styles.userBubble : styles.aiBubble,
              ]}
            >
              <Text style={styles.bubbleText}>{msg.content}</Text>
            </View>
            {msg.role === "user" && (
              <View style={styles.userBubbleIcon}>
                <Feather name="user" size={12} color="#0a0f1e" />
              </View>
            )}
          </View>
        ))}

        {isTyping && <TypingDots />}

        {messages.length === 1 && (
          <View style={styles.templates}>
            <Text style={styles.templatesTitle}>QUICK TEMPLATES</Text>
            <View style={styles.templateGrid}>
              {TEMPLATES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.templateBtn}
                  onPress={() => sendMessage(t.prompt)}
                  activeOpacity={0.75}
                >
                  <Feather name={t.icon} size={18} color={AMBER} />
                  <Text style={styles.templateLabel}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputArea}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Ask a legal question or request a draft..."
          placeholderTextColor={DIM}
          multiline
          maxLength={1000}
          returnKeyType="send"
          onSubmitEditing={() => sendMessage(input)}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!input.trim() || isTyping) && styles.sendBtnDisabled,
          ]}
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || isTyping}
          activeOpacity={0.8}
        >
          {isTyping ? (
            <ActivityIndicator color="#0a0f1e" size="small" />
          ) : (
            <Feather name="send" size={18} color="#0a0f1e" />
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.disclaimer}>
        AI-generated guidance only. Verify with a qualified lawyer.
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: CARD,
  },
  chatHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  botIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(139,92,246,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  chatHeaderTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "700",
  },
  chatHeaderSub: { color: DIM, fontSize: 11 },
  clearBtn: { padding: 6 },
  messagesContent: { padding: 16, paddingBottom: 8, gap: 12 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  msgRowUser: { justifyContent: "flex-end" },
  msgRowAI: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "80%",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: { backgroundColor: AMBER, borderBottomRightRadius: 4 },
  aiBubble: {
    backgroundColor: CARD,
    borderColor: BORDER,
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { color: TEXT, fontSize: 14, lineHeight: 20 },
  aiBubbleIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "rgba(139,92,246,0.12)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  userBubbleIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: AMBER,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  templates: { marginTop: 16, gap: 12 },
  templatesTitle: {
    color: DIM,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
  },
  templateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  templateBtn: {
    width: "47%",
    backgroundColor: CARD,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    gap: 8,
  },
  templateLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: CARD,
  },
  textInput: {
    flex: 1,
    backgroundColor: BG,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: TEXT,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: AMBER,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  disclaimer: {
    color: DIM,
    fontSize: 10,
    textAlign: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: CARD,
  },
});
