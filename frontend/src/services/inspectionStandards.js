// Standard US Inspection Standards & HIP-style field tags

export const INSPECTION_CATEGORIES = [
  { id: '', label: 'Auto (Let AI Categorize)', icon: '✨' },
  { id: 'Roofing & Attic', label: 'Roofing & Attic', icon: '🏠' },
  { id: 'Exterior & Grounds', label: 'Exterior & Grounds', icon: '🌳' },
  { id: 'Electrical Systems', label: 'Electrical Systems', icon: '⚡' },
  { id: 'Plumbing Systems', label: 'Plumbing Systems', icon: '🚰' },
  { id: 'HVAC (Heating & Cooling)', label: 'HVAC (Heating & Cooling)', icon: '❄️' },
  { id: 'Interior (Walls & Floors)', label: 'Interior (Walls & Floors)', icon: '🛋️' },
  { id: 'Structural & Foundation', label: 'Structural & Foundation', icon: '🏛️' },
  { id: 'Doors & Windows', label: 'Doors & Windows', icon: '🚪' },
  { id: 'Built-in Appliances', label: 'Built-in Appliances', icon: '🍳' },
  { id: 'Moisture & Mold Risk', label: 'Moisture & Mold Risk', icon: '💧' },
  { id: 'Other', label: 'Other (Custom Category)', icon: '📝' }
];

export const LOCATION_ROOMS = [
  'Kitchen',
  'Living Room',
  'Master Bedroom',
  'Bathroom',
  'Basement',
  'Attic',
  'Exterior Front',
  'Exterior Rear',
  'Garage',
  'Hallway',
  'Dining Room',
  'Crawlspace'
];

export const PHOTO_DIRECTIONS = [
  'Left Side',
  'Right Side',
  'Front View',
  'Rear View',
  'Ceiling',
  'Floor / Baseboard',
  'Under Sink',
  'Near Window',
  'Near Door',
  'Center / Overhead'
];

export const QUICK_RECOMMENDATIONS = [
  'Recommend evaluation and repair by a licensed contractor before closing.',
  'Safety hazard: Immediate correction or replacement advised.',
  'Monitor condition; re-evaluate during routine maintenance in 6 months.',
  'Recommend qualified licensed electrician evaluate circuit & panel.',
  'Recommend licensed plumber inspect active leak & supply lines.',
  'Recommend buyer request seller concession or repair prior to settlement.'
];
