import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Real route-based code splitting (App.jsx's React.lazy() per page) already moved
    // most pages out of the single ~1.2 MB chunk this warning used to fire on -- the
    // main entry chunk is now ~340 kB. The one chunk still over 500 kB is
    // LiveCameras.jsx bundled with hls.js (a genuinely large library, ~190 kB gzipped
    // on its own), and it's only ever downloaded when a user actually visits Live
    // Cameras, not on first load. Raising the warning threshold here reflects that
    // reality instead of hiding a real regression -- if this number needs to go up
    // again later, that's the signal to actually investigate, not to bump it further.
    chunkSizeWarningLimit: 650,
  },
})
