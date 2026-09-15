CREATE TYPE "public"."bank" AS ENUM('sber', 'alfa', 'tinkoff', 'vtb', 'ozon');--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "bank" "bank";--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "card_last4" text;