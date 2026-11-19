/** Design tokens: navy primary, slate text, muted semantic colours. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        navy: { 50:'#eef2f8',100:'#d9e2f0',200:'#b3c5e0',500:'#2b4a7e',600:'#1d3663',700:'#142849',800:'#0e1d36',900:'#0a1628' },
        surface: '#ffffff',
        canvas: '#f4f6f9',
        success: { DEFAULT:'#3f7d5c', soft:'#e6f1ea' },
        warn: { DEFAULT:'#b7791f', soft:'#fbf1dc' },
        danger: { DEFAULT:'#b4423c', soft:'#f8e8e7' },
      },
    },
  },
  plugins: [],
};
