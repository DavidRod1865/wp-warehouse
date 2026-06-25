/**
 * Icon — SVG icon system matching the design prototype.
 *
 * Usage: <Icon name="home" className="w-4 h-4" />
 */
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { name: keyof typeof icons }

const sp: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const icons = {
  home: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>
  ),
  box: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><path d="M3 7.5 12 3l9 4.5v9L12 21 3 16.5z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></svg>
  ),
  truck: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>
  ),
  clipboard: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><rect x="5" y="4" width="14" height="17" rx="1.5" /><path d="M9 4h6v3H9zM9 12h6M9 16h4" /></svg>
  ),
  invoice: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h6M9 16h6" /></svg>
  ),
  users: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><circle cx="9" cy="9" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="10" r="2.6" /><path d="M14.5 19a4.5 4.5 0 0 1 7 0" /></svg>
  ),
  chart: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><path d="M4 20h16M6 16v-4M10 16V8M14 16v-6M18 16V5" /></svg>
  ),
  settings: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 5l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
  ),
  search: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
  ),
  bell: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
  ),
  plus: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p} strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>
  ),
  arrow: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  ),
  alert: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><path d="M12 4 2.5 20h19zM12 10v5M12 18v.01" /></svg>
  ),
  check: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p} strokeWidth={1.8}><path d="m5 13 4 4L19 7" /></svg>
  ),
  info: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 10v6M12 7v.01" /></svg>
  ),
  sun: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></svg>
  ),
  moon: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" /></svg>
  ),
  filter: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><path d="M3 5h18l-7 9v6l-4-2v-4z" /></svg>
  ),
  upload: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
  ),
  download: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><path d="M12 4v12M7 11l5 5 5-5M4 20h16" /></svg>
  ),
  more: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></svg>
  ),
  close: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p} strokeWidth={1.8}><path d="m6 6 12 12M18 6 6 18" /></svg>
  ),
  sortAsc: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><path d="M6 9l3-3 3 3M9 6v14M15 15l3 3 3-3" /></svg>
  ),
  edit: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><path d="M13 5 18 10 9 19H4v-5z" /><path d="m13 5 2-2a2 2 0 0 1 3 3l-2 2" /></svg>
  ),
  refresh: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><path d="M4 12a8 8 0 0 1 14-5m2-3v5h-5M20 12a8 8 0 0 1-14 5m-2 3v-5h5" /></svg>
  ),
  scan: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" /></svg>
  ),
  package: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><path d="M3 7.5 12 3l9 4.5v9L12 21 3 16.5z" /><path d="M3 7.5 12 12l9-4.5M12 12v9M7.5 5.2l9 4.6" /></svg>
  ),
  mapPin: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><path d="M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>
  ),
  logout: (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
  ),
  'chevron-left': (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><path d="M15 18l-6-6 6-6" /></svg>
  ),
  'chevron-right': (p: SVGProps<SVGSVGElement>) => (
    <svg {...sp} {...p}><path d="M9 6l6 6-6 6" /></svg>
  ),
}

export type IconName = keyof typeof icons

export function Icon({ name, ...props }: IconProps) {
  const render = icons[name]
  if (!render) return null
  return render(props)
}

export { icons }
