/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#00e5c0',
        accent2: '#00aaff',
        danger: '#ff4d6d',
        warn: '#f4a261',
        bg0: '#080c10',
        bg1: '#0d1117',
        bg2: '#161b22',
        bg3: '#21262d',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
    },
  },
  plugins: [],
}
