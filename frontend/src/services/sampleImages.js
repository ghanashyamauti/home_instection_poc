// Curated sample defect cases for one-click testing and demonstration
export const SAMPLE_DEFECTS = [
  {
    id: 'wall-crack',
    title: 'Drywall Shear Crack',
    category: 'Structural',
    location: 'Living Room — North Load-Bearing Wall',
    comment: 'Noticeable diagonal crack propagating from door frame corner toward ceiling. Appears active.',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
      <defs>
        <linearGradient id="wall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#e2e8f0"/>
          <stop offset="50%" stop-color="#cbd5e1"/>
          <stop offset="100%" stop-color="#94a3b8"/>
        </linearGradient>
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise"/>
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.15 0"/>
          <feComposite in="SourceGraphic" in2="noise" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>
        </filter>
      </defs>
      <rect width="600" height="450" fill="url(#wall)"/>
      <!-- Drywall Texture Grid -->
      <path d="M 0,0 L 600,450 M 0,225 L 600,225 M 300,0 L 300,450" stroke="#94a3b8" stroke-width="0.5" opacity="0.3"/>
      <!-- Door frame header corner -->
      <rect x="0" y="280" width="220" height="170" fill="#f8fafc" stroke="#64748b" stroke-width="6"/>
      <rect x="15" y="295" width="190" height="155" fill="#e2e8f0"/>
      <!-- The severe diagonal settlement crack -->
      <path d="M 220,280 Q 250,250 280,220 T 320,180 T 370,140 T 430,90 T 490,40" stroke="#0f172a" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="M 220,280 Q 250,250 280,220 T 320,180 T 370,140 T 430,90 T 490,40" stroke="#475569" stroke-width="2" stroke-linecap="round" fill="none"/>
      <!-- Branch cracks -->
      <path d="M 320,180 Q 360,195 400,200" stroke="#1e293b" stroke-width="2.5" fill="none"/>
      <path d="M 430,90 Q 460,110 500,120" stroke="#1e293b" stroke-width="2" fill="none"/>
      <!-- Measuring scale indicator -->
      <rect x="250" y="250" width="70" height="18" fill="#fef08a" stroke="#ca8a04" stroke-width="1.5" rx="3"/>
      <text x="255" y="263" font-family="sans-serif" font-size="11" font-weight="bold" fill="#854d0e">3.5mm crack</text>
    </svg>`
  },
  {
    id: 'water-stain',
    title: 'Ceiling Water Intrusion',
    category: 'Moisture/Water',
    location: 'Second Floor Hallway Ceiling — Under Master Bath',
    comment: 'Yellow-brown water ring staining on drywall ceiling. Surrounding paint bubbling and peeling.',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
      <defs>
        <radialGradient id="waterStain" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#78350f" stop-opacity="0.85"/>
          <stop offset="35%" stop-color="#b45309" stop-opacity="0.7"/>
          <stop offset="70%" stop-color="#d97706" stop-opacity="0.4"/>
          <stop offset="90%" stop-color="#fef3c7" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="#f8fafc" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="600" height="450" fill="#f1f5f9"/>
      <!-- Ceiling tiles / drywall grid line -->
      <line x1="0" y1="220" x2="600" y2="220" stroke="#e2e8f0" stroke-width="2"/>
      <!-- Water ring accumulation -->
      <ellipse cx="310" cy="210" rx="190" ry="140" fill="url(#waterStain)"/>
      <ellipse cx="320" cy="205" rx="130" ry="90" fill="#92400e" opacity="0.3"/>
      <ellipse cx="300" cy="215" rx="70" ry="45" fill="#78350f" opacity="0.45"/>
      <!-- Peeling paint flake outlines -->
      <path d="M 280,200 Q 295,190 310,205 Q 325,215 305,225 Z" fill="#fde68a" stroke="#b45309" stroke-width="1.5"/>
      <path d="M 330,185 Q 350,175 365,195 Q 355,210 335,200 Z" fill="#fef3c7" stroke="#b45309" stroke-width="1.5"/>
      <!-- Active moisture badge indicator -->
      <circle cx="300" cy="215" r="8" fill="#0284c7" stroke="#ffffff" stroke-width="2"/>
    </svg>`
  },
  {
    id: 'exposed-wiring',
    title: 'Exposed Electrical Junction',
    category: 'Electrical',
    location: 'Basement Utility Room — Main Subpanel Wall',
    comment: 'Unenclosed wire splices hanging without junction box cover. Scorched insulation visible.',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
      <rect width="600" height="450" fill="#334155"/>
      <!-- Concrete block texture lines -->
      <line x1="0" y1="150" x2="600" y2="150" stroke="#475569" stroke-width="3"/>
      <line x1="0" y1="300" x2="600" y2="300" stroke="#475569" stroke-width="3"/>
      <!-- Open metal junction box -->
      <rect x="200" y="140" width="200" height="180" fill="#64748b" stroke="#94a3b8" stroke-width="6" rx="6"/>
      <rect x="215" y="155" width="170" height="150" fill="#1e293b"/>
      <!-- Heavy Romex cable feeding in -->
      <rect x="270" y="0" width="30" height="145" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
      <rect x="340" y="320" width="28" height="130" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
      <!-- Exposed loose copper wires -->
      <path d="M 285,150 Q 260,200 240,240 T 260,270" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/>
      <path d="M 285,150 Q 300,190 320,230 T 310,265" stroke="#ffffff" stroke-width="8" fill="none" stroke-linecap="round"/>
      <path d="M 285,150 Q 340,190 360,240 T 350,280" stroke="#b45309" stroke-width="6" fill="none" stroke-linecap="round"/>
      <!-- Bare copper pigtail -->
      <path d="M 240,240 Q 270,230 290,210" stroke="#b45309" stroke-width="5" fill="none"/>
      <!-- Yellow wire nut improperly placed -->
      <polygon points="310,245 325,235 330,260 315,265" fill="#eab308" stroke="#a16207" stroke-width="1.5"/>
      <!-- Danger burn scorch mark -->
      <ellipse cx="230" cy="180" rx="25" ry="18" fill="#000000" opacity="0.65"/>
    </svg>`
  },
  {
    id: 'mold-growth',
    title: 'Toxic Black Mold Colony',
    category: 'Mold/Biological',
    location: 'Basement North-East Foundation Wall & Baseboard',
    comment: 'Heavy fungal bloom along drywall baseboard and gypsum core. High relative humidity detected.',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
      <defs>
        <radialGradient id="moldCluster" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#052e16" stop-opacity="0.95"/>
          <stop offset="50%" stop-color="#14532d" stop-opacity="0.8"/>
          <stop offset="85%" stop-color="#365314" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="600" height="450" fill="#e2e8f0"/>
      <!-- Wood baseboard at floor -->
      <rect x="0" y="340" width="600" height="70" fill="#78350f" stroke="#451a03" stroke-width="4"/>
      <rect x="0" y="410" width="600" height="40" fill="#a16207"/>
      <!-- Mold blooms spreading upwards -->
      <circle cx="280" cy="310" r="85" fill="url(#moldCluster)"/>
      <circle cx="370" cy="280" r="75" fill="url(#moldCluster)"/>
      <circle cx="210" cy="330" r="60" fill="url(#moldCluster)"/>
      <circle cx="450" cy="320" r="70" fill="url(#moldCluster)"/>
      <circle cx="320" cy="230" r="50" fill="url(#moldCluster)"/>
      <!-- High density spore speckles -->
      <g fill="#022c22">
        <circle cx="270" cy="305" r="4"/><circle cx="290" cy="315" r="3"/><circle cx="285" cy="295" r="5"/>
        <circle cx="365" cy="275" r="4"/><circle cx="380" cy="290" r="3"/><circle cx="355" cy="265" r="5"/>
        <circle cx="320" cy="225" r="4"/><circle cx="330" cy="238" r="3"/><circle cx="310" cy="240" r="4"/>
      </g>
    </svg>`
  },
  {
    id: 'plumbing-pipe-corrosion',
    title: 'Corroded Galvanized Pipe & Leak',
    category: 'Plumbing',
    location: 'Crawlspace Main Supply Line',
    comment: 'Severe galvanic corrosion with greenish mineral efflorescence and active slow drip on copper-steel union.',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
      <rect width="600" height="450" fill="#1e293b"/>
      <!-- Wooden joists in background -->
      <rect x="0" y="30" width="600" height="60" fill="#78350f" stroke="#451a03" stroke-width="3"/>
      <!-- Pipe assembly horizontal -->
      <rect x="0" y="210" width="260" height="36" fill="#94a3b8" stroke="#475569" stroke-width="3"/>
      <!-- Corroded union fitting -->
      <rect x="260" y="195" width="80" height="66" fill="#047857" stroke="#065f46" stroke-width="4" rx="4"/>
      <!-- Continuing copper pipe -->
      <rect x="340" y="212" width="260" height="32" fill="#ea580c" stroke="#c2410c" stroke-width="3"/>
      <!-- Severe crusty oxidation corrosion -->
      <ellipse cx="300" cy="228" rx="35" ry="24" fill="#059669" stroke="#047857" stroke-width="2"/>
      <ellipse cx="285" cy="232" rx="18" ry="14" fill="#10b981" opacity="0.8"/>
      <!-- Active water droplet -->
      <path d="M 295,260 C 295,255 305,255 305,260 C 305,268 295,268 295,260 Z" fill="#38bdf8"/>
      <path d="M 297,290 C 297,282 307,282 307,290 C 307,300 297,300 297,290 Z" fill="#0284c7"/>
      <!-- Puddle on subfloor below -->
      <ellipse cx="300" cy="400" rx="90" ry="25" fill="#0284c7" opacity="0.6"/>
    </svg>`
  },
  {
    id: 'flooring-damage',
    title: 'Warped & Buckled Hardwood',
    category: 'Surface',
    location: 'Kitchen Island Perimeter',
    comment: 'Substantial plank cupping, separation, and discoloration caused by prolonged appliance leak.',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
      <rect width="600" height="450" fill="#78350f"/>
      <!-- Hardwood Floor Planks with warping -->
      <g stroke="#451a03" stroke-width="4">
        <rect x="0" y="0" width="600" height="70" fill="#a16207"/>
        <rect x="0" y="70" width="600" height="70" fill="#92400e"/>
        <!-- Buckled Planks (curved) -->
        <path d="M 0,140 Q 300,110 600,140 L 600,210 Q 300,180 0,210 Z" fill="#b45309"/>
        <path d="M 0,210 Q 300,175 600,210 L 600,285 Q 300,250 0,285 Z" fill="#713f12"/>
        <rect x="0" y="285" width="600" height="80" fill="#854d0e"/>
        <rect x="0" y="365" width="600" height="85" fill="#a16207"/>
      </g>
      <!-- Plank gaps from shrinkage/movement -->
      <line x1="280" y1="140" x2="310" y2="285" stroke="#1c1917" stroke-width="6"/>
      <!-- Moisture blackening along seam -->
      <ellipse cx="300" cy="210" rx="140" ry="40" fill="#000000" opacity="0.55"/>
    </svg>`
  }
];

// Helper to convert SVG text to a File object
export function svgToFile(svgString, filename) {
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  return new File([blob], filename, { type: 'image/svg+xml' });
}
