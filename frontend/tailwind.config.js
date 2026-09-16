/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brew: {
          50:  '#fdf8f0',
          100: '#faefd9',
          200: '#f3d9a8',
          300: '#eabd6f',
          400: '#e0a03a',
          500: '#c4841d',
          600: '#a06817',
          700: '#7d5014',
          800: '#5c3a10',
          900: '#3d260a',
        },
        roast: {
          50:  '#f5f0eb',
          100: '#e8ddd2',
          200: '#cdb89f',
          300: '#b0926c',
          400: '#8f6e42',
          500: '#6e5030',
          600: '#533c24',
          700: '#3d2c1a',
          800: '#271c10',
          900: '#150e07',
        }
      },
      fontFamily: {
        display: ['Georgia', 'serif'],
        body: ['system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
