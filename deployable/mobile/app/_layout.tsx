import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

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
              name="cases"
              options={{
                title: "CASES",
                headerTitle: "FORGED CASES",
                tabBarIcon: ({ color }) => <Feather name="file-text" size={22} color={color} />,
                tabBarLabel: "CASES",
              }}
            />
            <Tabs.Screen
              name="chains"
              options={{
                title: "CHAINS",
                headerTitle: "DATA PIPELINES",
                tabBarIcon: ({ color }) => <Feather name="link" size={22} color={color} />,
                tabBarLabel: "CHAINS",
              }}
            />
          </Tabs>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
