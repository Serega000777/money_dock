import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";

/**
 * The middle tab is an action, not a destination — focusing it opens the entry screen
 * and leaves the previous tab underneath, so closing the form returns where you were.
 */
export default function AddTab() {
  useFocusEffect(
    useCallback(() => {
      router.push("/add-transaction");
    }, []),
  );

  return <View />;
}
