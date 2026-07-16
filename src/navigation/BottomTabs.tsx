import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Library, Mic } from "lucide-react-native";

import { useTheme } from "../theme/ThemeProvider";
import { fonts } from "../theme/typography";
import { spacing } from "../theme/spacing";
import { LibraryScreen } from "../screens/LibraryScreen";

export type RootTabParamList = {
  Library: undefined;
  Assistant: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

/** Placeholder until the Assistant screen lands in a later phase. */
function AssistantPlaceholder() {
  const { palette } = useTheme();
  return (
    <View style={[styles.placeholder, { backgroundColor: palette.bg }]}>
      <Text style={[styles.placeholderText, { color: palette.ink }]}>
        Assistant
      </Text>
    </View>
  );
}

export function BottomTabs() {
  const { palette, mode } = useTheme();

  // Keep React Navigation's own colors (screen background, ripples, etc.)
  // in sync with the active palette.
  const navTheme = useMemo(() => {
    const base = mode === "dark" ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: palette.moss,
        background: palette.bg,
        card: palette.surface,
        text: palette.ink,
        border: palette.line,
      },
    };
  }, [mode, palette]);

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: palette.moss,
          tabBarInactiveTintColor: palette.inkSoft,
          tabBarStyle: {
            backgroundColor: palette.surface,
            borderTopColor: palette.line,
          },
          tabBarLabelStyle: {
            fontFamily: fonts.body.medium,
            fontSize: 11,
          },
        }}
      >
        <Tab.Screen
          name="Library"
          component={LibraryScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Library color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Assistant"
          component={AssistantPlaceholder}
          options={{
            tabBarIcon: ({ color, size }) => <Mic color={color} size={size} />,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  placeholderText: {
    fontFamily: fonts.display.semiBold,
    fontSize: 18,
  },
});
