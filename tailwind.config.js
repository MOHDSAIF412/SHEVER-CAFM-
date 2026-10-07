/** @type {import('tailwindcss').Config} */

// OCS Brand Guidelines 6.0 (Q323), page 19.
// Blue #293771 is the primary; Orange #F15F22 the accent; Green #00AE4D and
// Red #B91C2A are the RAG colours. The app's existing `teal` / `emerald` /
// `orange` utilities are remapped onto these scales so every screen picks up
// the brand without touching each class.
const ocsBlue = {
  50: '#eef0f8',
  100: '#dbdfef',
  200: '#b7bfe0',
  300: '#8f9bcd',
  400: '#7482c2',
  500: '#3f4e95',
  600: '#293771', // OCS Blue
  700: '#222e5f',
  800: '#1c264e',
  900: '#161e3e',
  950: '#0e1428',
};

const ocsOrange = {
  50: '#fef3ee',
  100: '#fde3d6',
  200: '#fbc5ab',
  300: '#f89e76',
  400: '#f57a48',
  500: '#f15f22', // OCS Orange
  600: '#d94c12',
  700: '#b33b10',
  800: '#8f3214',
  900: '#742c14',
  950: '#3f1308',
};

const ocsGreen = {
  50: '#e6f8ee',
  100: '#c2eed5',
  200: '#8fe0b2',
  300: '#4ccd86',
  400: '#1abd63',
  500: '#00ae4d', // OCS Green
  600: '#009241',
  700: '#007535',
  800: '#065d2d',
  900: '#074c27',
  950: '#022b15',
};

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Open Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        ocs: {
          blue: '#293771',
          orange: '#f15f22',
          green: '#00ae4d',
          red: '#b91c2a',
          'grey-light': '#c2c4c6',
          'grey-mid': '#808285',
          'grey-dark': '#4d4d4f',
        },
        teal: ocsBlue,
        emerald: ocsGreen,
        orange: ocsOrange,
      },
    },
  },
  plugins: [],
}
