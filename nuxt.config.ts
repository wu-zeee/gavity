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

  // Robert's Rules 设计稿（index.html）为浅色主题
  colorMode: {
    preference: 'light',
    fallback: 'light',
  },

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
      wrangler: {
        name: 'gavity',
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
