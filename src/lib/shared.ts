/**
 * Shapes and constants used by both the server and the browser.
 * Deliberately free of any Node imports so client components can pull from it.
 */
import type { Mark } from "./types";

export const MAX_MESSAGE_LENGTH = 140;

export interface PublicGame {
  dayKey: string;
  guesses: string[];
  marks: Mark[][];
  status: "playing" | "won" | "lost";
  /** Only ever populated once the game is over. */
  answer: string | null;
  hasPosted: boolean;
}

export interface CampsiteView {
  id: string;
  code: string;
  name: string;
  intensity: number;
  tier: string;
  tierLabel: string;
  tierBlurb: string;
  hoursRemaining: number;
  daysLit: number;
}

export interface MemberView {
  id: string;
  displayName: string;
  solvedToday: boolean;
  isYou: boolean;
}

export interface MessageView {
  id: string;
  author: string;
  text: string;
  createdAt: number;
  isYou: boolean;
}

/** Everything a screen needs, in one round trip. */
export interface CampState {
  user: { id: string; username: string; displayName: string };
  campsite: CampsiteView | null;
  members: MemberView[];
  game: PublicGame;
  messages: MessageView[];
  dayKey: string;
  msUntilNextWord: number;
  timeOffsetMs: number;
  serverTime: number;
}

export interface ApiSuccess {
  ok: true;
  state: CampState | null;
  code?: string;
  stoked?: boolean;
}

export interface ApiFailure {
  ok: false;
  error: string;
}

export type ApiResult = ApiSuccess | ApiFailure;
