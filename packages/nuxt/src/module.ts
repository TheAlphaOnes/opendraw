import { addComponent, addImports, createResolver, defineNuxtModule } from '@nuxt/kit'
// @nuxt/kit consumes this type but does not re-export it — it lives in schema.
import type { NuxtModule } from '@nuxt/schema'

/**
 * vuedraw — Excalidraw-style hand-drawn canvas for Nuxt 4.
 *
 * Registers the editor components and the useVueDraw() composable with
 * auto-import. Everything ships as ESM; no transpile config needed.
 *
 * ```ts
 * export default defineNuxtConfig({
 *   modules: ['vuedraw'],
 * })
 * ```
 *
 * ```vue
 * <template>
 *   <VueDraw ui="full" theme="light" />
 * </template>
 * ```
 */
export interface ModuleOptions {
  // Reserved for future module-level defaults; configure via component
  // props today. Keeping dead options out is deliberate.
}

const vuedrawModule: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'vuedraw',
    configKey: 'vuedraw',
  },
  defaults: {},
  setup(_options, _nuxt) {
    const resolver = createResolver(import.meta.url)

    addComponent({
      name: 'VueDraw',
      filePath: resolver.resolve('./runtime/components/VueDraw.vue'),
    })

    addComponent({
      name: 'VueDrawCanvas',
      filePath: resolver.resolve('./runtime/components/VueDrawCanvas.vue'),
    })

    addImports([
      {
        name: 'useVueDraw',
        from: resolver.resolve('./runtime/composables/useVueDraw'),
      },
      {
        name: 'createVueDrawContext',
        from: resolver.resolve('./runtime/composables/useVueDraw'),
      },
      {
        name: 'provideVueDraw',
        from: resolver.resolve('./runtime/composables/useVueDraw'),
      },
      {
        name: 'useScenePersistence',
        from: resolver.resolve('./runtime/composables/useScenePersistence'),
      },
    ])
  },
})

export default vuedrawModule
