CREATE TYPE "public"."import_job_status" AS ENUM('previewed', 'committed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."review_reason" AS ENUM('low_category_confidence', 'probable_duplicate', 'possible_transfer', 'import_error', 'missing_account');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pattern" text NOT NULL,
	"category_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_rules_user_pattern_unique" UNIQUE("user_id","pattern")
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_hash" text NOT NULL,
	"status" "import_job_status" DEFAULT 'previewed' NOT NULL,
	"stats_json" jsonb,
	"draft_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"committed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "review_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"reason" "review_reason" NOT NULL,
	"confidence" integer,
	"suggested_json" jsonb,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "category_rules_user_idx" ON "category_rules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "import_jobs_user_idx" ON "import_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "review_items_user_status_idx" ON "review_items" USING btree ("user_id","status");