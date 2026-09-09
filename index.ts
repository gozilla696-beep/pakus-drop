import React from 'react';
import { registerRootComponent } from 'expo';
import { View, Text, StyleSheet } from 'react-native';

function DiagnosticApp() {
  return React.createElement(
    View,
    { style: styles.screen },
    React.createElement(Text, { style: styles.title }, 'PAKUS DROP'),
    React.createElement(Text, { style: styles.ok }, 'START OK'),
    React.createElement(Text, { style: styles.info }, 'Diagnostic build · app runtime reached')
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#080817',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 14,
  },
  ok: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
  },
  info: {
    color: '#c8c8d8',
    fontSize: 15,
    textAlign: 'center',
  },
});

registerRootComponent(DiagnosticApp);
