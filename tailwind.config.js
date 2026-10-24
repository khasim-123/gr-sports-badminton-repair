/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,html}",
  ],
  theme: {
    extend: {
      colors: {
        sportsBlue: '#002B49',
        brandYellow: '#FCD116',
        actionGreen: '#00A859',
        flameRed: '#E53E3E',
        badmintonNavy: '#0F172A',
        courtGray: '#F1F5F9',
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#0f172a',
        },
        court: {
          green: '#10B981',
          lime: '#84CC16',
          dark: '#064E3B',
          light: '#ECFDF5'
        },
        // Public homepage palette: deep ink/navy, warm paper, one warm accent (brandYellow).
        ink: {
          DEFAULT: '#0F1B2B',
          soft: '#3A4757',
          muted: '#5C6878',
        },
        paper: {
          DEFAULT: '#F6F4EF',
          deep: '#EDEAE2',
        },
        line: '#E3DFD6',
        accent: {
          DEFAULT: '#FCD116',
          hover: '#F2C200',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Manrope', 'system-ui', 'sans-serif'],
        display: ['"Barlow Condensed"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'card': '14px',
        'badge': '8px',
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'xs': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.02)',
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'premium': '0 10px 25px -5px rgba(30, 58, 138, 0.08), 0 8px 10px -6px rgba(30, 58, 138, 0.04)',
        'elevated': '0 20px 35px -10px rgba(15, 23, 42, 0.12), 0 10px 10px -5px rgba(15, 23, 42, 0.04)',
      },
      backdropBlur: {
        'xs': '2px',
      },
      animation: {
        marquee: 'marquee 25s linear infinite',
        pulseSlow: 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        fadeIn: 'fadeIn 0.25s ease-out forwards'
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' }
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      }
    },
  },
  plugins: [],
}
