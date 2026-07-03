export type AccountType = "buyer" | "seller" | "both";

export interface PublicUser {
  id: string;
  username: string;
  email?: string;
  bio?: string | null;
  avatarSeed: string;
  verified: boolean;
  accountType: AccountType;
  createdAt?: string;
}

export interface SampleSummary {
  id: string;
  title: string;
  description: string;
  genre: string;
  bpm: number;
  key: string;
  imageUrl?: string | null;
  waveform: number[];
  startingPriceCents: number;
  currentPriceCents: number;
  buyNowPriceCents: number | null;
  minIncrementCents: number;
  antiSnipeSeconds: number;
  status: "live" | "ended";
  startTime: string;
  endTime: string;
  createdAt: string;
  seller?: { id: string; username: string; verified: boolean; avatarSeed: string };
  winner?: { id: string; username: string; avatarSeed: string } | null;
  bidCount?: number;
  canDownloadFull: boolean;
  hasStems?: boolean;
  hasMidi?: boolean;
  certificateCode?: string;
}

export interface BidEntry {
  id: string;
  amountCents: number;
  createdAt: string;
  user: { id: string; username: string; avatarSeed: string };
}

export interface NotificationEntry {
  id: string;
  type: "outbid" | "won" | "lost" | "sold" | "unsold";
  message: string;
  read: boolean;
  createdAt: string;
  sample?: { id: string; title: string } | null;
}

export interface LeaderboardEntry {
  user: { id: string; username: string; verified: boolean; avatarSeed: string };
  spentCents?: number;
  wins?: number;
  earnedCents?: number;
  sales?: number;
}

export interface ContestedSample {
  id: string;
  title: string;
  bidCount: number;
  currentPriceCents: number;
}

/** Response shape from GET /api/samples (paginated). */
export interface PaginatedSamples {
  samples: SampleSummary[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}
