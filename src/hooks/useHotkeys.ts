import { useEffect } from 'react';
import { Platform } from 'react-native';

export interface HotkeyBinding {
  /** Single printable key ('k', '/', 'n', 'j', 'k', 'r', '?'). Case-insensitive. */
  key: string;
  /** Require Cmd on mac, Ctrl elsewhere. Defaults to false. */
  mod?: boolean;
  /** Require Shift. Defaults to false. */
  shift?: boolean;
  /** Handler — return truthy to consume; falsy to let browser / focus target handle it. */
  handler: (event: KeyboardEvent) => void | boolean;
  /** When true, still fire while typing in <input>/<textarea>/contentEditable. Default false. */
  allowInInput?: boolean;
}

/**
 * Web-only keyboard shortcut manager. On native platforms this hook is a
 * no-op so importing it from shared components is safe.
 */
export function useHotkeys(bindings: HotkeyBinding[]): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inEditable = Boolean(
        target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable),
      );
      const modExpected = event.metaKey || event.ctrlKey;

      for (const binding of bindings) {
        if (!binding.allowInInput && inEditable) continue;
        if ((binding.mod ?? false) !== modExpected) continue;
        if ((binding.shift ?? false) !== event.shiftKey) continue;
        if (event.key.toLowerCase() !== binding.key.toLowerCase()) continue;
        const consumed = binding.handler(event);
        if (consumed !== false) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [bindings]);
}

/** Human-readable label for a shortcut chord, respecting platform. */
export function hotkeyLabel(binding: Pick<HotkeyBinding, 'key' | 'mod' | 'shift'>): string {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
    return binding.key.toUpperCase();
  }
  const mac = /Mac|iPhone|iPad/i.test(navigator.userAgent);
  const parts: string[] = [];
  if (binding.mod) parts.push(mac ? '⌘' : 'Ctrl');
  if (binding.shift) parts.push(mac ? '⇧' : 'Shift');
  parts.push(binding.key.length === 1 ? binding.key.toUpperCase() : binding.key);
  return parts.join(mac ? '' : '+');
}
