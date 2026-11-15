-- Tracking must remain disabled until the account has an explicit opt-in.
ALTER TABLE "UserSettings"
  ALTER COLUMN "cookieAnalytics" SET DEFAULT false,
  ALTER COLUMN "cookieMarketing" SET DEFAULT false;

-- Backfill the privacy switches from the most recent auditable consent decision.
-- Missing or explicitly unset consent is treated as denied.
UPDATE "UserSettings" AS settings
SET
  "cookieAnalytics" = COALESCE((
    SELECT consent."granted"
    FROM "ConsentRecord" AS consent
    WHERE consent."userId" = settings."userId"
      AND consent."type" IN ('analytics', 'analytics:NOT_SET')
    ORDER BY consent."createdAt" DESC, consent."id" DESC
    LIMIT 1
  ), false),
  "cookieMarketing" = COALESCE((
    SELECT consent."granted"
    FROM "ConsentRecord" AS consent
    WHERE consent."userId" = settings."userId"
      AND consent."type" IN ('marketing', 'marketing:NOT_SET')
    ORDER BY consent."createdAt" DESC, consent."id" DESC
    LIMIT 1
  ), false);
