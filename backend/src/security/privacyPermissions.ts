/**
 * Evaluate a followers-only privacy preference against the direction of the
 * relationship: the target account must follow the actor who is interacting
 * with them. Missing/unknown values preserve the legacy public default.
 */
export function canReceiveMention(modeValue: unknown, targetFollowsActor: boolean): boolean {
  const mode = String(modeValue || "everyone").toLowerCase();
  if (mode === "nobody" || mode === "noone" || mode === "none") return false;
  if (mode === "followers" || mode === "following") return targetFollowsActor;
  return true;
}
