export default defineAppConfig({
  ui: {
    colors: {
      primary: 'swiss',
      secondary: 'swiss',
      info: 'morandi-blue',
      success: 'morandi-olive',
      warning: 'morandi-amber',
      error: 'morandi-red',
      neutral: 'zinc',
    },
    // Swiss design: zero border-radius (switch/radio/avatar/progress keep rounded-full)
    button: { slots: { base: 'rounded-none' } },
    badge: { slots: { base: 'rounded-none' } },
    modal: {
      slots: { content: 'rounded-none' },
      variants: { fullscreen: { false: { content: 'rounded-none' } } },
    },
    input: { slots: { base: 'rounded-none' } },
    textarea: { slots: { base: 'rounded-none' } },
    alert: { slots: { root: 'rounded-none' } },
    toast: { slots: { root: 'rounded-none' } },
    select: { slots: { base: 'rounded-none', content: 'rounded-none' } },
    tooltip: { slots: { content: 'rounded-none' } },
    card: { slots: { root: 'rounded-none' } },
    checkbox: { slots: { base: 'rounded-none' } },
    popover: { slots: { content: 'rounded-none' } },
    dropdownMenu: { slots: { content: 'rounded-none' } },
    contextMenu: { slots: { content: 'rounded-none' } },
  },
});
