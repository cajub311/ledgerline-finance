import type { ReactNode } from 'react';
import { Modal as RNModal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { radius, spacing, typography } from '../../theme/tokens';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function Modal({ visible, onClose, title, subtitle, children, footer, width = 460 }: ModalProps) {
  const { palette } = useTheme();
  if (!visible) return null;

  return (
    <RNModal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: palette.overlay }]} onPress={onClose}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={[
            styles.card,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              width,
              maxWidth: '94%',
            },
          ]}
        >
          {title ? (
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
                {subtitle ? (
                  <Text style={[styles.subtitle, { color: palette.textMuted }]}>{subtitle}</Text>
                ) : null}
              </View>
              <Pressable onPress={onClose} style={styles.close}>
                <Text style={[styles.closeText, { color: palette.textMuted }]}>✕</Text>
              </Pressable>
            </View>
          ) : null}
          <ScrollView contentContainerStyle={{ gap: spacing.md }} style={{ maxHeight: 520 }}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  title: {
    fontSize: typography.title,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: typography.small,
    marginTop: 4,
  },
  close: {
    padding: spacing.xs,
  },
  closeText: {
    fontSize: typography.subtitle,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});
