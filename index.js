import React from 'react';
import { registerRootComponent } from 'expo';
import { View, Text, StyleSheet } from 'react-native';

function DiagnosticApp() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>PAKUS DROP</Text>
      <Text style={styles.ok}>START OK</Text>
      <Text style={styles.info}>Minimal iOS startup diagnostic</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#111111',
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 14,
  },
  ok: {
    color: '#0a7a2f',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
  },
  info: {
    color: '#333333',
    fontSize: 15,
    textAlign: 'center',
  },
});

registerRootComponent(DiagnosticApp);
