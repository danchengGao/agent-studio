import { defineConfig } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'

export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve' || mode === 'development'

  return {
    plugins: isDev ? [react()] : [react(), dts()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    build: isDev
      ? {}
      : {
          lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'TestAgentStudioBaseUI',
            fileName: format => `index.${format}.js`,
            formats: ['es', 'cjs'],
          },
          rollupOptions: {
            external: [
              'react',
              'react-dom',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-icons',
              '@radix-ui/react-label',
              '@radix-ui/react-popover',
              '@radix-ui/react-select',
              '@radix-ui/react-slot',
              '@radix-ui/react-switch',
              '@radix-ui/react-checkbox',
              'class-variance-authority',
              'clsx',
              'tailwind-merge',
              'lucide-react',
            ],
            output: {
              globals: {
                react: 'React',
                'react-dom': 'ReactDOM',
              },
            },
          },
          sourcemap: true,
        },
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
  }
})
