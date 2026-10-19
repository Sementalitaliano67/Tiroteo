/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
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
        // Escala de grises por variables: el modo oscuro la invierte (ver index.css).
        neutral: Object.fromEntries(
          [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((k) => [k, `rgb(var(--neutral-${k}) / <alpha-value>)`]),
        ),
        surface: 'rgb(var(--surface) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
