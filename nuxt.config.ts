import process from 'node:process';

export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
  ],

  app: {
    head: {
      title: 'Gavity',
      meta: [
        { name: 'description', content: '基于罗伯特议事规则的会议工具' },
      ],
    },
  },

  css: ['~/app.css'],

  compatibilityDate: '2026-07-23',

  ssr: false,

  nitro: {
    preset: 'cloudflare-module',

    typescript: {
      tsConfig: {
        compilerOptions: {
          types: ['@cloudflare/workers-types'],
        },
      },
    },

    cloudflare: {
      nodeCompat: true,
      wrangler: {
        name: 'gavity',
        compatibility_flags: ['nodejs_compat'],
        d1_databases: [{
          binding: 'DB',
          database_id: process.env.GAVITY_CF_DB_ID,
        }],
      },
    },
  },

  fonts: {
    provider: 'bunny',
    providers: {
      google: false,
      googleicons: false,
    },
  },

  icon: {
    clientBundle: {
      scan: true,
    },
  },
});
