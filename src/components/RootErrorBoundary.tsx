import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

export class RootErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Ledgerline]', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.shell}>
          <Text style={styles.title}>Ledgerline could not start</Text>
          <Text style={styles.body}>{this.state.message}</Text>
          <Text style={styles.hint}>
            If you use strict privacy mode or blocked storage, try allowing site data for this domain
            or open the site in another browser, then reload.
          </Text>
          {Platform.OS === 'web' ? (
            <Pressable
              accessibilityRole="button"
              style={styles.button}
              onPress={() => {
                globalThis.location?.reload();
              }}
            >
              <Text style={styles.buttonText}>Reload page</Text>
            </Pressable>
          ) : null}
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0b1020',
    gap: 12,
  },
  title: {
    color: '#f5f7ff',
    fontSize: 20,
    fontWeight: '800',
  },
  body: {
    color: '#b8c0d9',
    fontSize: 14,
    lineHeight: 20,
  },
  hint: {
    color: '#7d87a6',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  button: {
    marginTop: 16,
    alignSelf: 'flex-start',
    backgroundColor: '#6d7dff',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
});
