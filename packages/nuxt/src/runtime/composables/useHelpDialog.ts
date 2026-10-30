import { inject, provide, ref, type InjectionKey, type Ref } from 'vue'

/**
 * The editor's help dialog ("?") state, shared by every surface that opens
 * it, the "?" key, the help button and the main menu's Help item.
 */
const HELP_DIALOG_KEY: InjectionKey<Ref<boolean>> = Symbol('opendraw-help-dialog')

export function provideHelpDialog(): Ref<boolean> {
  const open = ref(false)
  provide(HELP_DIALOG_KEY, open)
  return open
}

/** The enclosing editor's dialog state, or a private one when standalone. */
export function useHelpDialog(): Ref<boolean> {
  return inject(HELP_DIALOG_KEY, () => ref(false), true)
}
