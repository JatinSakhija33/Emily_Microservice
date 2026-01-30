import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': '475px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      fontFamily: {
        'sans': ['Roboto', 'sans-serif'],
      },
      colors: {
        pink: {
          500: '#ec4899',
          600: '#db2777',
          700: '#be185d',
        },
        purple: {
          500: '#a855f7',
          600: '#9333ea',
        }
      }
    },
  },
  plugins: [typography],
}

