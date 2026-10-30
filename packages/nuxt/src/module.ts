import { addComponent, addImports, createResolver, defineNuxtModule } from '@nuxt/kit'
// @nuxt/kit consumes this type but does not re-export it — it lives in schema.
import type { NuxtModule } from '@nuxt/schema'

/**
 * opendraw — Excalidraw-style hand-drawn canvas for Nuxt 4.
 *
 * Registers the editor components and the useOpenDraw() composable with
 * auto-import. Everything ships as ESM; no transpile config needed.
 *
 * ```ts
 * export default defineNuxtConfig({
 *   modules: ['@opendraw/nuxt'],
 * })
 * ```
 *
 * ```vue
 * <template>
 *   <OpenDraw ui="full" theme="light" />
 * </template>
 * ```
 */
export interface ModuleOptions {
  // Reserved for future module-level defaults; configure via component
  // props today. Keeping dead options out is deliberate.
}

const opendrawModule: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@opendraw/nuxt',
    configKey: 'opendraw',
  },
  defaults: {},
  setup(_options, _nuxt) {
    const resolver = createResolver(import.meta.url)

    addComponent({
      name: 'OpenDraw',
      filePath: resolver.resolve('./runtime/components/OpenDraw.vue'),
    })

    addComponent({
      name: 'OpenDrawCanvas',
      filePath: resolver.resolve('./runtime/components/OpenDrawCanvas.vue'),
    })

    addImports([
      {
        name: 'useOpenDraw',
        from: resolver.resolve('./runtime/composables/useOpenDraw'),
      },
      {
        name: 'createOpenDrawContext',
        from: resolver.resolve('./runtime/composables/useOpenDraw'),
      },
      {
        name: 'provideOpenDraw',
        from: resolver.resolve('./runtime/composables/useOpenDraw'),
      },
      {
        name: 'useScenePersistence',
        from: resolver.resolve('./runtime/composables/useScenePersistence'),
      },
    ])
  },
})

export default opendrawModule
