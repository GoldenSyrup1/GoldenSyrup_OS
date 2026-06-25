/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        syrup: {
          50: '#fff8e6',
          100: '#ffedbf',
          300: '#f5c451',
          500: '#e0a020', // golden syrup
          700: '#a86f10',
          900: '#5c3a06',
        },
        ink: {
          900: '#0d1117',
          800: '#161b22',
          700: '#21262d',
          600: '#30363d',
        },
        status: {
          live: '#3fb950',
          progress: '#d29922',
          blocked: '#f85149',
          idle: '#8b949e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
