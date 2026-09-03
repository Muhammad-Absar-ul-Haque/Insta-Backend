export interface UserSummary {
  id: number;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
}

type UserLike = {
  id: number;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
};

/** The minimal author shape embedded in posts/comments/reels/messages responses. */
export function toUserSummary(user: UserLike): UserSummary {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    isVerified: user.isVerified,
  };
}

export const USER_SUMMARY_SELECT = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true,
  isVerified: true,
} as const;
