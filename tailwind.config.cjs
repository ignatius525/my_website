/** @type {import('tailwindcss').Config} */
// Palette sampled from the "shepherd at dusk" LinkedIn banner.
// Keep in sync with PALETTE in src/components/canvas/pasture/palette.js.
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  mode: "jit",
  theme: {
    extend: {
      colors: {
        // page + surfaces (night sky)
        primary: "#1c1938",
        night: "#1c1938",
        dusk: "#282248",
        plum: "#392854",
        tertiary: "#2c2547",
        "black-100": "#231d3f",
        "black-200": "#15122b",
        // text
        secondary: "#b9aed0",
        "white-100": "#f6eac6",
        // accents
        sun: "#ffc666",
        "sun-core": "#ffeaae",
        ember: "#ff964e",
        horizon: "#ab5860",
        cloud: "#665a7e",
        wool: "#dec6ae",
        "wool-light": "#f6eac6",
        grass: "#42664e",
        "grass-dark": "#365a42",
        "grass-deep": "#1e422a",
        "grass-light": "#759059",
        wood: "#966636",
        "wood-light": "#ae8a5a",
        "wood-dark": "#4e361e",
        lantern: "#f6d272",
        hedge: "#2c3d44", // Steam-profile panel title bars
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', "monospace"],
        sans: ['"Pixel Five"', '"Pixelify Sans"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0px 35px 120px -15px #15122b",
      },
      screens: {
        xs: "450px",
      },
    },
  },
  plugins: [],
};
