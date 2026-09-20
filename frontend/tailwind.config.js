/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
  safelist: [
    'btn', 'btn-fire', 'btn-ghost', 'btn-danger',
    'panel', 'chip', 'chip-on',
    'tog', 'tog-on', 'tog-off', 'tog-knob',
    'field', 'badge',
    'badge-pending', 'badge-brewing', 'badge-ready', 'badge-done', 'badge-cancelled',
    'dot', 'dot-pending', 'dot-brewing', 'dot-ready',
    'icon-btn', 'stepper-btn',
    'display', 'data', 'label',
    'heat-border', 'heat-border-urgent',
    'flip-wrapper', 'flip-card', 'flipping',
    'skeleton', 'page-enter', 'page-enter-child',
    'wake-banner', 'success-overlay', 'menu-card',
    'scrollbar-none', 'kds-row',
    'md-grid-3', 'md-hidden',
  ]
}
