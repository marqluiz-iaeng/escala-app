export type Role = 'freelancer' | 'company';

export type DataMapItem = {
  id: string; title: string; data: string; purpose: string; legalBasis: string; retention: string; sharing: string;
};

export type Meta = {
  policyVersion: string;
  controller: { name: string; dpoName: string; dpoEmail: string };
  dataMap: DataMapItem[];
  demoAccounts: { label: string; hint: string; email: string; password: string }[];
  demoInbox: boolean;
};

export type Me = {
  id: string; role: Role; displayName: string; fullName: string; email: string; phone: string; city: string;
  createdAt: number; rating: number | null; ratingCount: number; unread: number;
  freelancer?: { categories: string[]; bio: string; experienceYears: number; dayRateCents: number | null; available: boolean; discoverable: boolean };
  company?: { segment: string; about: string; verified: boolean; cnpjMasked: string };
};

export type Gig = {
  id: string; title: string; category: string; description: string; city: string; neighbourhood: string; date: string;
  startTime: string; endTime: string; payCents: number; payType: string; slots: number; slotsLeft: number; status: string;
  company: { id: string; name: string; segment: string | null; about: string; verified: boolean; rating: number | null; ratingCount: number };
  myApplication?: { id: string; status: string } | null;
  pendingCount?: number;
  acceptedCount?: number;
};

export type Talent = {
  id: string; displayName: string; city: string | null; categories: string[]; bio: string; experienceYears: number;
  dayRateCents: number | null; available: boolean; rating: number | null; ratingCount: number;
};

export type Application = {
  id: string; status: string; createdAt: number; note: string | null; gig: Gig; unread: number; lastMessageAt: number | null;
  canReview: boolean; contactUnlocked: boolean; freelancer?: Talent;
};

export type ApplicationDetail = Application & {
  other: { displayName: string; contact: { fullName: string | null; phone: string | null } | null };
  address: string | null;
};

export type Message = { id: string; mine: boolean; body: string | null; at: number; masked?: boolean };

export type Consent = { granted: boolean; version: string; at: number } | null;

export type PrivacyOverview = {
  consents: { terms: Consent; discovery: Consent; marketing: Consent };
  consentHistory: { purpose: string; version: string; granted: boolean; at: number }[];
  accessLog: { action: string; at: number; actor: string | null }[];
  activity: { action: string; at: number }[];
  sessions: { device: string; createdAt: number; lastSeenAt: number; current: boolean }[];
};
