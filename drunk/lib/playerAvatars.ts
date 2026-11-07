// Players' photos live on their account (drunk_users.avatar_url). A players row
// only holds a copy taken when they joined, which goes stale or stays empty if
// they weren't signed in on that device at the time. Selecting the linked
// account alongside the player lets every device show the account's current
// photo, falling back to the copy on the players row.

/** Use with `.from('players').select(PLAYER_SELECT)`. */
export const PLAYER_SELECT = '*, account:drunk_users(avatar_url)';

export const withLiveAvatars = <T extends Record<string, any>>(rows: T[] | null | undefined): T[] =>
  (rows || []).map((row) => {
    const { account, ...rest } = row as any;
    const live = account?.avatar_url;
    return (live ? { ...rest, avatar_url: live } : rest) as T;
  });
