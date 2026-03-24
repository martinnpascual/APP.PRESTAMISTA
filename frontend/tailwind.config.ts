import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Estado de cuotas — semáforo visual
        cobrado: '#16a34a',   // verde
        pendiente: '#ca8a04', // amarillo
        mora: '#dc2626',      // rojo
      },
    },
  },
  plugins: [],
}

export default config
