// Which user's transactions a shared-terminal screen should load. Admins and
// owners see the whole yard (undefined = no user filter). A worker sees the
// staffer currently PIN'd in at the terminal, falling back to the device's
// signed-in account — NOT the device account alone, or a worker's own buys
// vanish from their list whenever a different account is signed in on the shared
// device (#50).
export function resolveStafferScopeUserId(
  isAdmin: boolean,
  activeStafferUserId: string | undefined,
  deviceUserId: string | undefined
): string | undefined {
  if (isAdmin) return undefined;
  return activeStafferUserId ?? deviceUserId;
}
