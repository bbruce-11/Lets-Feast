import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { getToken, setToken, clearToken } from "../lib/auth";
import { courierApi } from "../lib/api";
import type { CourierOrder } from "../lib/api";

export default function CourierApp() {
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then((t) => {
      setTokenState(t);
      setLoading(false);
    });
  }, []);

  const handleLogin = (t: string) => {
    setTokenState(t);
  };

  const handleLogout = async () => {
    await clearToken();
    setTokenState(null);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </SafeAreaView>
    );
  }

  if (!token) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <OrdersScreen onLogout={handleLogout} />;
}

function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) return;
    setIsLoading(true);
    try {
      const data = await courierApi.signin(email, password);
      await setToken(data.token);
      onLogin(data.token);
    } catch (err) {
      Alert.alert(
        "Login Failed",
        err instanceof Error ? err.message : "Invalid credentials"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.loginCard}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>🚗</Text>
        </View>
        <Text style={styles.loginTitle}>Courier Login</Text>
        <Text style={styles.loginSubtitle}>
          Sign in with your driver account to see assigned deliveries.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#64748b"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!isLoading}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#64748b"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!isLoading}
        />

        <TouchableOpacity
          style={[styles.btn, (!email || !password || isLoading) && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={!email || !password || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function OrdersScreen({ onLogout }: { onLogout: () => void }) {
  const [orders, setOrders] = useState<CourierOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advancingId, setAdvancingId] = useState<number | null>(null);

  const fetchOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await courierApi.getMyOrders();
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleAdvance = async (orderId: number, nextStatus: string) => {
    setAdvancingId(orderId);
    try {
      await courierApi.updateStatus(orderId, nextStatus);
      await fetchOrders();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to update order");
    } finally {
      setAdvancingId(null);
    }
  };

  const statusLabel = (s: string) => {
    const labels: Record<string, string> = {
      confirmed: "Confirmed",
      preparing: "Preparing",
      driver_assigned: "Assigned to You",
      on_the_way: "On the Way",
      delivered: "Delivered",
    };
    return labels[s] ?? s;
  };

  const nextStatus = (s: string): string | null => {
    if (s === "driver_assigned") return "on_the_way";
    if (s === "on_the_way") return "delivered";
    return null;
  };

  const nextLabel = (s: string): string | null => {
    if (s === "driver_assigned") return "Start Delivery";
    if (s === "on_the_way") return "Mark Delivered";
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Deliveries</Text>
          <Text style={styles.headerSub}>{orders.length} active order{orders.length !== 1 ? "s" : ""}</Text>
        </View>
        <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.btn} onPress={fetchOrders}>
            <Text style={styles.btnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>✅</Text>
          <Text style={styles.emptyTitle}>No Active Deliveries</Text>
          <Text style={styles.emptySubtitle}>
            You&apos;ll see new assignments here when they come in.
          </Text>
          <TouchableOpacity style={[styles.btn, { marginTop: 16 }]} onPress={fetchOrders}>
            <Text style={styles.btnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {orders.map((order) => {
            const next = nextStatus(order.status);
            const label = nextLabel(order.status);
            const isAdvancing = advancingId === order.id;
            return (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <Text style={styles.orderId}>#{order.id}</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{statusLabel(order.status)}</Text>
                  </View>
                </View>

                {order.restaurantName && (
                  <Text style={styles.restaurantName}>{order.restaurantName}</Text>
                )}

                {order.customerName && (
                  <Text style={styles.detail}>
                    <Text style={styles.detailLabel}>Customer: </Text>
                    {order.customerName}
                  </Text>
                )}

                {order.deliveryAddress && (
                  <Text style={styles.detail}>
                    <Text style={styles.detailLabel}>Deliver to: </Text>
                    {order.deliveryAddress}
                  </Text>
                )}

                <View style={styles.itemList}>
                  {order.items.map((item, idx) => (
                    <Text key={idx} style={styles.itemText}>
                      {item.quantity}× {item.name}
                    </Text>
                  ))}
                </View>

                {next && label && (
                  <TouchableOpacity
                    style={[styles.advanceBtn, isAdvancing && styles.btnDisabled]}
                    onPress={() => handleAdvance(order.id, next)}
                    disabled={isAdvancing}
                  >
                    {isAdvancing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.btnText}>{label}</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    backgroundColor: "#0f172a",
  },
  headerTitle: { color: "#f8fafc", fontSize: 20, fontWeight: "700" },
  headerSub: { color: "#64748b", fontSize: 13, marginTop: 2 },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  logoutText: { color: "#64748b", fontSize: 14 },
  loginCard: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#1e3a8a",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 8,
  },
  logoText: { fontSize: 28 },
  loginTitle: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  loginSubtitle: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  btn: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  advanceBtn: {
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  list: { padding: 16, gap: 16 },
  orderCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  orderId: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  statusBadge: {
    backgroundColor: "#1d4ed8",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: { color: "#bfdbfe", fontSize: 12, fontWeight: "600" },
  restaurantName: { color: "#94a3b8", fontSize: 14, marginBottom: 6 },
  detail: { color: "#cbd5e1", fontSize: 14, marginBottom: 4 },
  detailLabel: { color: "#94a3b8", fontWeight: "600" },
  itemList: { marginTop: 8, marginBottom: 4 },
  itemText: { color: "#e2e8f0", fontSize: 14, marginBottom: 2 },
  loadingText: { color: "#64748b", marginTop: 12, fontSize: 14 },
  errorText: { color: "#f87171", textAlign: "center", marginBottom: 16 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptySubtitle: { color: "#64748b", textAlign: "center", fontSize: 14 },
});
