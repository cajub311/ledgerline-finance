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
    backgroundColor: '#071218',
    gap: 12,
  },
  title: {
    color: '#eff7f4',
    fontSize: 20,
    fontWeight: '800',
  },
  body: {
    color: '#b9ccd0',
    fontSize: 14,
    lineHeight: 20,
  },
  hint: {
    color: '#94bdc4',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  button: {
    marginTop: 16,
    alignSelf: 'flex-start',
    backgroundColor: '#d4e37d',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    color: '#182015',
    fontWeight: '800',
    fontSize: 14,
  },
});
