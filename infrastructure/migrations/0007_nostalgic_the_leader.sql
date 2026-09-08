CREATE TYPE "public"."insight_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."insight_type" AS ENUM('category_growth');--> statement-breakpoint
CREATE TABLE "insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "insight_type" NOT NULL,
	"entity_id" uuid,
	"severity" "insight_severity" NOT NULL,
	"payload_json" jsonb NOT NULL,
	"message_template_key" text NOT NULL,
	"priority" integer DEFAULT 50 NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "insights_user_type_entity_unique" UNIQUE("user_id","type","entity_id")
);
--> statement-breakpoint
CREATE TABLE "merchant_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"normalized_name" text NOT NULL,
	"raw_pattern" text NOT NULL,
	"default_category_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_aliases_raw_pattern_unique" UNIQUE("raw_pattern")
);
--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_aliases" ADD CONSTRAINT "merchant_aliases_default_category_id_categories_id_fk" FOREIGN KEY ("default_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "insights_user_idx" ON "insights" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "merchant_aliases_normalized_idx" ON "merchant_aliases" USING btree ("normalized_name");