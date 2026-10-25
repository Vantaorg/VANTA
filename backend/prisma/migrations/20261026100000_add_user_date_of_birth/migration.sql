-- Add optional date of birth without changing or deleting existing user data.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);