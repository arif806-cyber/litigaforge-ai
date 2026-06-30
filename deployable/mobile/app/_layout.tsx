import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { AuthProvider } from "@/lib/auth-context";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 2 } },
});

const AMBER = "#f59e0b";
const MUTED = "#4b5563";
const BG = "#0a0f1e";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="light" backgroundColor={BG} />
            <Tabs
              screenOptions={{
                headerStyle: { backgroundColor: BG },
                headerTintColor: "#f8fafc",
                headerTitleStyle: {
                  fontWeight: "700",
                  letterSpacing: 2,
                  fontSize: 13,
                  color: AMBER,
                },
                tabBarStyle: {
                  backgroundColor: "#0d1526",
                  borderTopColor: "rgba(255,255,255,0.06)",
                  height: 64,
                  paddingBottom: 10,
                },
                tabBarActiveTintColor: AMBER,
                tabBarInactiveTintColor: MUTED,
                tabBarLabelStyle: { fontSize: 10, fontWeight: "600", letterSpacing: 1 },
              }}
            >
              <Tabs.Screen
                name="index"
                options={{
                  title: "FORGE",
                  headerTitle: "LITIGAFORGE AI",
                  tabBarIcon: ({ color }) => <Feather name="zap" size={22} color={color} />,
                  tabBarLabel: "FORGE",
                }}
              />
              <Tabs.Screen
                name="post-case"
                options={{
                  title: "POST CASE",
                  headerTitle: "POST A CASE",
                  tabBarIcon: ({ color }) => <Feather name="file-plus" size={22} color={color} />,
                  tabBarLabel: "POST",
                }}
              />
              <Tabs.Screen
                name="my-cases"
                options={{
                  title: "MY CASES",
                  headerTitle: "MY CASES",
                  tabBarIcon: ({ color }) => <Feather name="folder" size={22} color={color} />,
                  tabBarLabel: "MY CASES",
                }}
              />
              <Tabs.Screen
                name="matches"
                options={{
                  title: "MATCHES",
                  headerTitle: "AI MATCHES",
                  tabBarIcon: ({ color }) => <Feather name="users" size={22} color={color} />,
                  tabBarLabel: "MATCHES",
                }}
              />
              <Tabs.Screen
                name="chat"
                options={{
                  title: "CHAT",
                  headerTitle: "LEGAL AI CHAT",
                  tabBarIcon: ({ color }) => <Feather name="message-circle" size={22} color={color} />,
                  tabBarLabel: "CHAT",
                }}
              />

              {/* Hidden routes — accessible via router.push but not shown in tab bar */}
              <Tabs.Screen
                name="login"
                options={{
                  tabBarButton: () => null,
                  headerTitle: "SIGN IN",
                  title: "Sign In",
                }}
              />
              <Tabs.Screen
                name="cases"
                options={{
                  tabBarButton: () => null,
                  headerTitle: "FORGED CASES",
                  title: "Cases",
                }}
              />
              <Tabs.Screen
                name="chains"
                options={{
                  tabBarButton: () => null,
                  headerTitle: "DATA PIPELINES",
                  title: "Chains",
                }}
              />
              <Tabs.Screen
                name="case/[id]"
                options={{
                  tabBarButton: () => null,
                  headerTitle: "CASE DETAIL",
                  title: "Case Detail",
                }}
              />
            </Tabs>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
