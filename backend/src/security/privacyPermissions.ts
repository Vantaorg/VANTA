/**
 * Evaluate a followers-only privacy preference against the direction of the
 * relationship: the actor must follow the target account they are mentioning. Missing/unknown values preserve the legacy public default.
 */
export function canReceiveMention(modeValue: unknown, actorFollowsTarget: boolean): boolean {
  const mode = String(modeValue || "everyone").toLowerCase();
  if (mode === "nobody" || mode === "noone" || mode === "none") return false;
  if (mode === "followers" || mode === "following") return actorFollowsTarget;
  return true;
}
