import { useColorScheme } from "react-native";
import colors from "@/constants/colors";

/**
 * Returns the design tokens for the current color scheme. Light-only for
 * now (FEAST's brand palette hasn't been extended to a dark variant yet) -
 * this hook exists so screens don't hardcode colors, and a dark palette can
 * be dropped in later without touching every screen.
 */
export function useColors() {
  useColorScheme();
  return { ...colors.light, radius: colors.radius };
}
