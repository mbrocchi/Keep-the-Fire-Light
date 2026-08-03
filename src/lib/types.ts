export type Mark = "correct" | "present" | "absent";

export interface FireState {
  /** 0-100, as of `updatedAt`. Current value must be derived via decay. */
  intensity: number;
  /** Epoch ms (game time) at which `intensity` was accurate. */
  updatedAt: number;
}

export interface User {
  id: string;
  username: string; // lowercased, unique
  displayName: string;
  passwordHash: string;
  salt: string;
  campsiteId: string | null;
  createdAt: number;
}

export interface Campsite {
  id: string;
  code: string; // 6 chars, unambiguous alphabet
  name: string;
  createdBy: string;
  createdAt: number;
  fire: FireState;
}

export interface Game {
  id: string;
  userId: string;
  campsiteId: string | null;
  dayKey: string; // YYYY-MM-DD (UTC, game time)
  guesses: string[];
  marks: Mark[][];
  status: "playing" | "won" | "lost";
  completedAt: number | null;
  /** True once this game has stoked the fire, so it can only ever do so once. */
  stoked: boolean;
}

export interface Message {
  id: string;
  userId: string;
  campsiteId: string;
  dayKey: string;
  text: string;
  createdAt: number;
}

export interface Db {
  users: User[];
  campsites: Campsite[];
  games: Game[];
  messages: Message[];
  dev: { timeOffsetMs: number };
}

export const EMPTY_DB: Db = {
  users: [],
  campsites: [],
  games: [],
  messages: [],
  dev: { timeOffsetMs: 0 },
};
