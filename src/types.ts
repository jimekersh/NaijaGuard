export const NIGERIA_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", 
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo", 
  "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", 
  "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", 
  "Yobe", "Zamfara"
];

export const THREAT_CATEGORIES = [
  { id: 'kidnapping', label: 'Kidnapping', risk: 'high' },
  { id: 'banditry', label: 'Banditry', risk: 'high' },
  { id: 'robbery', label: 'Armed Robbery', risk: 'high' },
  { id: 'roadblock', label: 'Illegal Roadblock', risk: 'moderate' },
  { id: 'protest', label: 'Protest/Civil Unrest', risk: 'moderate' },
  { id: 'clash', label: 'Communal Clash', risk: 'high' },
  { id: 'other', label: 'Other Security Threat', risk: 'low' }
];

export interface SecurityReport {
  id: string;
  userId: string;
  isAnonymous: boolean;
  category: string;
  description: string;
  state: string;
  lga: string;
  lat?: number;
  lng?: number;
  timestamp: number;
  riskLevel: 'critical' | 'high' | 'moderate' | 'low';
  verificationCount: number;
  flagCount?: number;
  isVerified: boolean;
  status?: 'pending' | 'verified' | 'flagged';
  aiCredibilityScore: number;
  aiThreatType?: string;
  aiLandmarks?: string; // Stored as JSON string
  aiIsMisinformation?: boolean;
  aiAnalysisSummary?: string;
  source?: string;
  sourceUrl?: string;
}

export interface User {
  id: string;
  phoneNumber: string;
  reputationScore: number;
  trustScore: number;
  reportCount: number;
  verificationCount: number;
  languagePreference: string;
  isRegisteredIndividual: boolean;
  realName?: string;
}

export interface DistressSignal {
  id: string;
  userId: string;
  realName?: string;
  lat: number;
  lng: number;
  timestamp: number;
  status: 'active' | 'resolved';
}
