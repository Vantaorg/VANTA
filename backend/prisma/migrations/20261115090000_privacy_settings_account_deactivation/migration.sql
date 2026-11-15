-- Add Privacy Center settings and account lifecycle state.
ALTER TABLE "UserSettings"
  ADD COLUMN "accountType" TEXT NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN "onlineStatus" TEXT NOT NULL DEFAULT 'everyone',
  ADD COLUMN "lastSeen" TEXT NOT NULL DEFAULT 'everyone',
  ADD COLUMN "privacyReadReceipts" TEXT NOT NULL DEFAULT 'everyone',
  ADD COLUMN "storyVisibility" TEXT NOT NULL DEFAULT 'everyone',
  ADD COLUMN "liveStreamVisibility" TEXT NOT NULL DEFAULT 'everyone',
  ADD COLUMN "communityInvites" TEXT NOT NULL DEFAULT 'everyone',
  ADD COLUMN "groupInvites" TEXT NOT NULL DEFAULT 'everyone',
  ADD COLUMN "messagePermissions" TEXT NOT NULL DEFAULT 'everyone',
  ADD COLUMN "callPermissions" TEXT NOT NULL DEFAULT 'everyone',
  ADD COLUMN "tagPermissions" TEXT NOT NULL DEFAULT 'everyone',
  ADD COLUMN "mentionPermissions" TEXT NOT NULL DEFAULT 'everyone',
  ADD COLUMN "profileSearchVisibility" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "searchVisibility" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "discoverability" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "aiPersonalization" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "adPersonalization" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "cookieAnalytics" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "cookieMarketing" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "cookieFunctional" BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE "AccountDeactivation" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "deactivationType" TEXT NOT NULL, "reason" TEXT, "reasonDetail" TEXT, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "deactivatedAt" TIMESTAMP(3), "scheduledFor" TIMESTAMP(3), "recoveryPeriodEnd" TIMESTAMP(3), "recoveryToken" TEXT, "recoveredAt" TIMESTAMP(3), "permanentlyDeletedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AccountDeactivation_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "AccountDeactivation_userId_key" ON "AccountDeactivation"("userId");
CREATE INDEX "AccountDeactivation_status_scheduledFor_idx" ON "AccountDeactivation"("status", "scheduledFor");
CREATE INDEX "AccountDeactivation_status_recoveryPeriodEnd_idx" ON "AccountDeactivation"("status", "recoveryPeriodEnd");
CREATE INDEX "AccountDeactivation_deactivatedAt_idx" ON "AccountDeactivation"("deactivatedAt");
ALTER TABLE "AccountDeactivation" ADD CONSTRAINT "AccountDeactivation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CopyrightClaim" ("id" TEXT NOT NULL, "claimantName" TEXT NOT NULL, "claimantEmail" TEXT NOT NULL, "claimantUserId" TEXT, "rightsHolderName" TEXT NOT NULL, "rightsHolderContact" TEXT, "originalWorkTitle" TEXT NOT NULL, "originalWorkUrl" TEXT, "originalWorkDescription" TEXT, "infringingUrl" TEXT NOT NULL, "infringingContentId" TEXT, "infringingContentType" TEXT, "status" TEXT NOT NULL DEFAULT 'PENDING', "actionTaken" TEXT, "counterNoticeId" TEXT, "counterNoticeAt" TIMESTAMP(3), "infringingUserId" TEXT, "infringementCount" INTEGER NOT NULL DEFAULT 1, "processedById" TEXT, "processedAt" TIMESTAMP(3), "decisionNote" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CopyrightClaim_pkey" PRIMARY KEY ("id"));
CREATE INDEX "CopyrightClaim_status_createdAt_idx" ON "CopyrightClaim"("status", "createdAt");
CREATE INDEX "CopyrightClaim_claimantEmail_idx" ON "CopyrightClaim"("claimantEmail");
CREATE INDEX "CopyrightClaim_infringingUserId_idx" ON "CopyrightClaim"("infringingUserId");
CREATE INDEX "CopyrightClaim_infringingContentType_infringingContentId_idx" ON "CopyrightClaim"("infringingContentType", "infringingContentId");
CREATE INDEX "CopyrightClaim_status_processedById_idx" ON "CopyrightClaim"("status", "processedById");
ALTER TABLE "CopyrightClaim" ADD CONSTRAINT "CopyrightClaim_claimantUserId_fkey" FOREIGN KEY ("claimantUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CounterNotice" ("id" TEXT NOT NULL, "copyrightClaimId" TEXT NOT NULL, "respondentName" TEXT NOT NULL, "respondentEmail" TEXT NOT NULL, "respondentUserId" TEXT, "statement" TEXT NOT NULL, "signature" TEXT NOT NULL, "contactInfo" TEXT, "status" TEXT NOT NULL DEFAULT 'PENDING', "processedById" TEXT, "processedAt" TIMESTAMP(3), "decisionNote" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CounterNotice_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "CounterNotice_copyrightClaimId_key" ON "CounterNotice"("copyrightClaimId");
CREATE INDEX "CounterNotice_status_createdAt_idx" ON "CounterNotice"("status", "createdAt");
ALTER TABLE "CounterNotice" ADD CONSTRAINT "CounterNotice_copyrightClaimId_fkey" FOREIGN KEY ("copyrightClaimId") REFERENCES "CopyrightClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CounterNotice" ADD CONSTRAINT "CounterNotice_respondentUserId_fkey" FOREIGN KEY ("respondentUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RepeatInfringement" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "infringementCount" INTEGER NOT NULL DEFAULT 1, "lastClaimId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'MONITORING', "warningSentAt" TIMESTAMP(3), "lockedAt" TIMESTAMP(3), "terminatedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "RepeatInfringement_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "RepeatInfringement_userId_key" ON "RepeatInfringement"("userId");
CREATE INDEX "RepeatInfringement_status_idx" ON "RepeatInfringement"("status");
CREATE INDEX "RepeatInfringement_infringementCount_status_idx" ON "RepeatInfringement"("infringementCount", "status");
ALTER TABLE "RepeatInfringement" ADD CONSTRAINT "RepeatInfringement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommunityStandard" ("id" TEXT NOT NULL, "type" TEXT NOT NULL, "title" TEXT NOT NULL, "content" TEXT NOT NULL, "version" TEXT NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT TRUE, "publishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CommunityStandard_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "CommunityStandard_type_key" ON "CommunityStandard"("type");
CREATE INDEX "CommunityStandard_type_isActive_idx" ON "CommunityStandard"("type", "isActive");
CREATE INDEX "CommunityStandard_version_idx" ON "CommunityStandard"("version");

CREATE TABLE "PolicyVersion" ("id" TEXT NOT NULL, "policyType" TEXT NOT NULL, "version" TEXT NOT NULL, "title" TEXT NOT NULL, "content" TEXT NOT NULL, "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "effectiveAt" TIMESTAMP(3) NOT NULL, "isCurrent" BOOLEAN NOT NULL DEFAULT FALSE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PolicyVersion_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "PolicyVersion_policyType_version_key" ON "PolicyVersion"("policyType", "version");
CREATE INDEX "PolicyVersion_policyType_isCurrent_idx" ON "PolicyVersion"("policyType", "isCurrent");
CREATE INDEX "PolicyVersion_policyType_effectiveAt_idx" ON "PolicyVersion"("policyType", "effectiveAt");

CREATE TABLE "PolicyAcceptance" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "policyType" TEXT NOT NULL, "policyVersion" TEXT NOT NULL, "accepted" BOOLEAN NOT NULL DEFAULT TRUE, "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "ipAddress" TEXT, "userAgent" TEXT, CONSTRAINT "PolicyAcceptance_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "PolicyAcceptance_userId_policyType_key" ON "PolicyAcceptance"("userId", "policyType");
CREATE INDEX "PolicyAcceptance_userId_idx" ON "PolicyAcceptance"("userId");
CREATE INDEX "PolicyAcceptance_policyType_policyVersion_idx" ON "PolicyAcceptance"("policyType", "policyVersion");
CREATE INDEX "PolicyAcceptance_acceptedAt_idx" ON "PolicyAcceptance"("acceptedAt");
ALTER TABLE "PolicyAcceptance" ADD CONSTRAINT "PolicyAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TransparencyMetric" ("id" TEXT NOT NULL, "metricType" TEXT NOT NULL, "period" TEXT NOT NULL, "periodStart" TIMESTAMP(3) NOT NULL, "periodEnd" TIMESTAMP(3) NOT NULL, "totalCount" INTEGER NOT NULL DEFAULT 0, "actionBreakdown" TEXT, "notes" TEXT, "publishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "TransparencyMetric_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "TransparencyMetric_metricType_period_periodStart_key" ON "TransparencyMetric"("metricType", "period", "periodStart");
CREATE INDEX "TransparencyMetric_period_periodStart_idx" ON "TransparencyMetric"("period", "periodStart");

CREATE TABLE "ChildSafetyFlag" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "flagType" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW', "ageEstimate" INTEGER, "declaredAge" INTEGER, "actionTaken" TEXT, "actionDetail" TEXT, "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3), "escalationLevel" TEXT NOT NULL DEFAULT 'NORMAL', "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ChildSafetyFlag_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ChildSafetyFlag_userId_idx" ON "ChildSafetyFlag"("userId");
CREATE INDEX "ChildSafetyFlag_status_escalationLevel_idx" ON "ChildSafetyFlag"("status", "escalationLevel");
CREATE INDEX "ChildSafetyFlag_flagType_status_idx" ON "ChildSafetyFlag"("flagType", "status");
CREATE INDEX "ChildSafetyFlag_status_createdAt_idx" ON "ChildSafetyFlag"("status", "createdAt");
ALTER TABLE "ChildSafetyFlag" ADD CONSTRAINT "ChildSafetyFlag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModerationQueue"
  ADD COLUMN "targetUserId" TEXT,
  ADD COLUMN "category" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "evidenceUrls" TEXT;

-- Preserve any deletion requests already recorded by the legacy GDPR flow.
INSERT INTO "AccountDeactivation" ("id", "userId", "deactivationType", "reason", "status", "deactivatedAt", "scheduledFor", "recoveryPeriodEnd", "createdAt", "updatedAt")
SELECT 'legacy-' || request."id", request."userId", 'SCHEDULED', request."reason", 'SCHEDULED_FOR_DELETION', request."createdAt", request."scheduledFor", request."scheduledFor", request."createdAt", CURRENT_TIMESTAMP
FROM "AccountDeletionRequest" AS request
WHERE request."status" = 'PENDING'
ON CONFLICT ("userId") DO NOTHING;
