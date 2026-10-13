/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef9f0',
          100: '#d6f0db',
          200: '#aee0b9',
          300: '#7ccc91',
          400: '#4cb468',
          500: '#2d9a4a',
          600: '#1f7a3a',
          700: '#1a6131',
          800: '#164d28',
          900: '#103d20',
        },
        accent: {
          50: '#fff8eb',
          100: '#ffedc6',
          200: '#ffd988',
          300: '#ffc043',
          400: '#ffa617',
          500: '#f58400',
          600: '#d96a00',
          700: '#b04f00',
          800: '#8a3f00',
          900: '#713600',
        },
        neutral: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
