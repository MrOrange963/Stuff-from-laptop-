import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        marcus: '0 10px 30px rgba(15, 23, 42, 0.12)',
      },
      colors: {
        marcus: {
          50: '#f8f2f3',
          100: '#f0e4e7',
          200: '#dac5cc',
          300: '#c2a3ae',
          400: '#a67981',
          500: '#8f4f56',
          600: '#7c3f45',
          700: '#68343a',
          800: '#542a30',
          900: '#412024',
        },
      },
    },
  },
  plugins: [],
};

export default config;
