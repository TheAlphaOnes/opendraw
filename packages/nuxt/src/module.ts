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

    // The demo site as one component, configured with defineOpenDrawConfig().
    addComponent({
      name: 'OpenDrawApp',
      filePath: resolver.resolve('./runtime/components/OpenDrawApp.vue'),
    })

    // Ready-made pieces for <OpenDraw>'s top-right and footer slots.
    for (const name of ['OpenDrawButton', 'OpenDrawCopyCommand', 'OpenDrawShareButton']) {
      addComponent({ name, filePath: resolver.resolve(`./runtime/components/slots/${name}.vue`) })
    }

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
        name: 'defineOpenDrawConfig',
        from: resolver.resolve('./runtime/config/openDrawApp'),
      },
      {
        name: 'useScenePersistence',
        from: resolver.resolve('./runtime/composables/useScenePersistence'),
      },
      {
        name: 'useDrawingFiles',
        from: resolver.resolve('./runtime/composables/useDrawingFiles'),
      },
    ])
  },
})

export default opendrawModule
