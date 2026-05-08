export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif'],
        mono:    ['"JetBrains Mono"', '"SF Mono"', '"Fira Code"', 'monospace'],
      },
      colors: {
        accent: {
          DEFAULT: '#007AFF',
          soft:    '#EFF6FF',
          mid:     '#DBEAFE',
          dark:    '#1D4ED8',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          soft:    '#FAFAFA',
          subtle:  '#F3F4F6',
        },
        ink: {
          DEFAULT: '#111827',
          secondary: '#6B7280',
          muted:   '#9CA3AF',
          border:  '#F3F4F6',
          'border-strong': '#E5E7EB',
        },
      },
      boxShadow: {
        subtle:    '0 4px 24px rgba(0,0,0,0.04)',
        premium:   '0 12px 48px rgba(0,0,0,0.08)',
        floating:  '0 20px 80px rgba(0,0,0,0.12)',
        glow:      '0 0 0 3px rgba(0,122,255,0.15)',
        'inner-sm': 'inset 0 1px 2px rgba(255,255,255,0.9)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
        '5xl': '48px',
      },
      letterSpacing: {
        tighter: '-0.04em',
        tight:   '-0.03em',
        snug:    '-0.02em',
        widest:  '0.25em',
      },
      animation: {
        'pulse-slow':  'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'mesh-spin':   'meshSpin 18s ease-in-out infinite',
        'ripple':      'ripple 2s ease-out infinite',
        'shimmer':     'shimmer 1.6s infinite',
        'fade-up':     'fadeUp 0.6s ease both',
      },
      keyframes: {
        meshSpin: {
          '0%':   { transform: 'rotate(0deg) scale(1)' },
          '50%':  { transform: 'rotate(180deg) scale(1.08)' },
          '100%': { transform: 'rotate(360deg) scale(1)' },
        },
        ripple: {
          '0%':   { transform: 'scale(1)',   opacity: '0.5' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        fadeUp: {
          from: { opacity: 0, transform: 'translateY(16px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
