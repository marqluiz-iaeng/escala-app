// Gerado por `pnpm --filter @escala/api db:pull`. Não edite à mão.
import { currencyCode, geography, moneyCents, tsvector } from '../column-types.js';
import { pgTable, index, foreignKey, pgPolicy, check, uuid, text, timestamp, unique, boolean, integer, jsonb, bigint, numeric, smallint, uniqueIndex, date, primaryKey, time, pgSequence, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const appealStatus = pgEnum("appeal_status", ['open', 'upheld', 'rejected'])
export const applicationOrigin = pgEnum("application_origin", ['applied', 'invited'])
export const applicationStatus = pgEnum("application_status", ['invited', 'applied', 'shortlisted', 'selected', 'rejected', 'withdrawn', 'expired'])
export const authProvider = pgEnum("auth_provider", ['google', 'apple', 'linkedin', 'email'])
export const checkInKind = pgEnum("check_in_kind", ['in', 'out'])
export const checkInSource = pgEnum("check_in_source", ['device', 'manual'])
export const companyMemberRole = pgEnum("company_member_role", ['owner', 'admin', 'recruiter'])
export const companySegment = pgEnum("company_segment", ['producao_musical', 'festas_eventos', 'entretenimento', 'bar_restaurante', 'hospedagem', 'outros'])
export const companyStatus = pgEnum("company_status", ['pending', 'active', 'suspended', 'deleted'])
export const contractParty = pgEnum("contract_party", ['company', 'freelancer', 'platform'])
export const contractStatus = pgEnum("contract_status", ['proposed', 'accepted', 'declined', 'expired', 'in_progress', 'awaiting_confirmation', 'completed', 'cancelled', 'no_show', 'disputed'])
export const conversationStatus = pgEnum("conversation_status", ['open', 'closed'])
export const dataRequestKind = pgEnum("data_request_kind", ['export', 'deletion'])
export const dataRequestStatus = pgEnum("data_request_status", ['pending', 'done', 'rejected'])
export const devicePlatform = pgEnum("device_platform", ['ios', 'android', 'web'])
export const disputeDecision = pgEnum("dispute_decision", ['favor_company', 'favor_freelancer', 'partial', 'no_action'])
export const disputeReason = pgEnum("dispute_reason", ['no_show', 'cancelamento', 'pagamento_nao_confirmado', 'conduta', 'check_in'])
export const disputeStatus = pgEnum("dispute_status", ['opened', 'collecting_evidence', 'under_review', 'decided', 'applied', 'closed', 'withdrawn'])
export const documentKind = pgEnum("document_kind", ['identidade', 'certificado', 'outro'])
export const documentStatus = pgEnum("document_status", ['pending', 'approved', 'rejected', 'expired'])
export const fileScanStatus = pgEnum("file_scan_status", ['pending', 'clean', 'infected', 'failed'])
export const jobStatus = pgEnum("job_status", ['draft', 'published', 'filled', 'closed', 'cancelled', 'expired'])
export const kycKind = pgEnum("kyc_kind", ['cpf_birthdate', 'identity_document'])
export const legalDocumentKind = pgEnum("legal_document_kind", ['terms', 'privacy', 'contract_template'])
export const messageKind = pgEnum("message_kind", ['text', 'image', 'file', 'audio', 'system'])
export const messageStatus = pgEnum("message_status", ['visible', 'hidden', 'removed'])
export const mfaKind = pgEnum("mfa_kind", ['totp', 'recovery_code'])
export const notificationChannel = pgEnum("notification_channel", ['push', 'email'])
export const otpPurpose = pgEnum("otp_purpose", ['login', 'email_change', 'step_up'])
export const payUnit = pgEnum("pay_unit", ['diaria', 'hora', 'cache'])
export const penaltyStatus = pgEnum("penalty_status", ['active', 'appealed', 'reversed', 'expired'])
export const platformRole = pgEnum("platform_role", ['none', 'support', 'admin'])
export const profileStatus = pgEnum("profile_status", ['active', 'suspended', 'deleted'])
export const replyStatus = pgEnum("reply_status", ['published', 'hidden'])
export const reportReason = pgEnum("report_reason", ['assedio', 'golpe', 'ofensa', 'dados_pessoais', 'outro'])
export const reportStatus = pgEnum("report_status", ['open', 'upheld', 'dismissed'])
export const reviewCriterion = pgEnum("review_criterion", ['pontualidade', 'qualidade', 'comunicacao', 'postura', 'clareza_vaga', 'ambiente', 'pagamento_em_dia', 'respeito'])
export const reviewSide = pgEnum("review_side", ['company', 'freelancer'])
export const reviewStatus = pgEnum("review_status", ['submitted', 'published', 'hidden'])
export const safetyAlertStatus = pgEnum("safety_alert_status", ['open', 'handling', 'closed'])
export const shiftStatus = pgEnum("shift_status", ['scheduled', 'in_progress', 'done', 'no_show', 'cancelled'])
export const skillLevel = pgEnum("skill_level", ['iniciante', 'intermediario', 'avancado'])
export const ticketCategory = pgEnum("ticket_category", ['combinado_pagamento', 'conta', 'seguranca', 'disputa'])
export const ticketPriority = pgEnum("ticket_priority", ['low', 'normal', 'high', 'urgent'])
export const ticketStatus = pgEnum("ticket_status", ['open', 'pending_user', 'pending_support', 'resolved', 'closed'])
export const userStatus = pgEnum("user_status", ['pending', 'active', 'suspended', 'banned', 'deleted'])
export const verificationMethod = pgEnum("verification_method", ['cnpj_lookup', 'manual'])
export const verificationStatus = pgEnum("verification_status", ['pending', 'approved', 'rejected', 'expired'])

export const pgmigrationsIdSeq = pgSequence("pgmigrations_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "2147483647", cache: "1", cycle: false })

export const companies = pgTable("companies", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	tradeName: text("trade_name").notNull(),
	segment: companySegment().notNull(),
	about: text().default('').notNull(),
	logoFileId: uuid("logo_file_id"),
	city: text(),
	publicLocation: geography("public_location"),
	status: companyStatus().default('pending').notNull(),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("companies_location_idx").using("gist", table.publicLocation.asc().nullsLast().op("gist_geography_ops")),
	index("companies_logo_idx").using("btree", table.logoFileId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.logoFileId],
			foreignColumns: [files.id],
			name: "companies_logo_file_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "companies_created_by_fkey"
		}),
	pgPolicy("companies_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`(((app.current_user_id() IS NOT NULL) AND (status = 'active'::company_status) AND (deleted_at IS NULL)) OR (created_by = app.current_user_id()) OR app.is_company_member(id))` }),
	pgPolicy("companies_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("companies_app_update", { as: "permissive", for: "update", to: ["escala_app"] }),
	pgPolicy("companies_worker_select", { as: "permissive", for: "select", to: ["escala_worker"] }),
	pgPolicy("companies_support_all", { as: "permissive", for: "all", to: ["escala_support"] }),
	check("companies_trade_name_check", sql`(char_length(trade_name) >= 2) AND (char_length(trade_name) <= 80)`),
	check("companies_about_check", sql`char_length(about) <= 1000`),
]);

export const users = pgTable("users", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	emailIndex: text("email_index"),
	emailEnc: text("email_enc"),
	phoneEnc: text("phone_enc"),
	legalNameEnc: text("legal_name_enc"),
	cpfIndex: text("cpf_index"),
	cpfEnc: text("cpf_enc"),
	birthDateEnc: text("birth_date_enc"),
	status: userStatus().default('pending').notNull(),
	platformRole: platformRole("platform_role").default('none').notNull(),
	lastActiveAt: timestamp("last_active_at", { withTimezone: true, mode: 'string' }),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [table.id],
			name: "users_created_by_fkey"
		}),
	unique("users_email_index_key").on(table.emailIndex),
	unique("users_cpf_index_key").on(table.cpfIndex),
	pgPolicy("users_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`(id = app.current_user_id())` }),
	pgPolicy("users_app_update", { as: "permissive", for: "update", to: ["escala_app"] }),
	pgPolicy("users_auth_all", { as: "permissive", for: "all", to: ["escala_auth"] }),
	pgPolicy("users_worker_select", { as: "permissive", for: "select", to: ["escala_worker"] }),
	check("users_email_pair", sql`(email_index IS NULL) = (email_enc IS NULL)`),
	check("users_cpf_pair", sql`(cpf_index IS NULL) = (cpf_enc IS NULL)`),
	check("users_deleted_consistent", sql`(status = 'deleted'::user_status) = (deleted_at IS NOT NULL)`),
	check("users_email_required", sql`(status = 'deleted'::user_status) OR (email_index IS NOT NULL)`),
	check("users_deleted_has_no_pii", sql`(status <> 'deleted'::user_status) OR (num_nonnulls(email_enc, phone_enc, legal_name_enc, cpf_enc, birth_date_enc) = 0)`),
]);

export const authIdentities = pgTable("auth_identities", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	provider: authProvider().notNull(),
	providerSubject: text("provider_subject").notNull(),
	emailEnc: text("email_enc"),
	emailVerified: boolean("email_verified").default(false).notNull(),
	isPrivateRelay: boolean("is_private_relay").default(false).notNull(),
	appleRefreshTokenEnc: text("apple_refresh_token_enc"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("auth_identities_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "auth_identities_user_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "auth_identities_created_by_fkey"
		}),
	unique("auth_identities_provider_provider_subject_key").on(table.provider, table.providerSubject),
	pgPolicy("auth_identities_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`(user_id = app.current_user_id())` }),
	pgPolicy("auth_identities_auth_all", { as: "permissive", for: "all", to: ["escala_auth"] }),
	check("auth_identities_apple_token", sql`(provider = 'apple'::auth_provider) OR (apple_refresh_token_enc IS NULL)`),
]);

export const mfaFactors = pgTable("mfa_factors", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	kind: mfaKind().notNull(),
	secretEnc: text("secret_enc").notNull(),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("mfa_factors_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "mfa_factors_user_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "mfa_factors_created_by_fkey"
		}),
	pgPolicy("mfa_factors_auth_all", { as: "permissive", for: "all", to: ["escala_auth"], using: sql`true`, withCheck: sql`true`  }),
]);

export const sessions = pgTable("sessions", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	deviceId: uuid("device_id"),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	revokedReason: text("revoked_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("sessions_device_idx").using("btree", table.deviceId.asc().nullsLast().op("uuid_ops")),
	index("sessions_expiry_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	index("sessions_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.deviceId],
			foreignColumns: [devices.id],
			name: "sessions_device_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "sessions_created_by_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "sessions_user_id_fkey"
		}),
	pgPolicy("sessions_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`(user_id = app.current_user_id())` }),
	pgPolicy("sessions_app_update", { as: "permissive", for: "update", to: ["escala_app"] }),
	pgPolicy("sessions_auth_all", { as: "permissive", for: "all", to: ["escala_auth"] }),
]);

export const refreshTokens = pgTable("refresh_tokens", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	tokenHash: text("token_hash").notNull(),
	usedAt: timestamp("used_at", { withTimezone: true, mode: 'string' }),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("refresh_tokens_expiry_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	index("refresh_tokens_session_idx").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [sessions.id],
			name: "refresh_tokens_session_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "refresh_tokens_created_by_fkey"
		}),
	unique("refresh_tokens_token_hash_key").on(table.tokenHash),
	pgPolicy("refresh_tokens_auth_all", { as: "permissive", for: "all", to: ["escala_auth"], using: sql`true`, withCheck: sql`true`  }),
]);

export const devices = pgTable("devices", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	platform: devicePlatform().notNull(),
	label: text().notNull(),
	pushTokenEnc: text("push_token_enc"),
	appVersion: text("app_version"),
	lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("devices_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "devices_user_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "devices_created_by_fkey"
		}),
	pgPolicy("devices_app_all", { as: "permissive", for: "all", to: ["escala_app"], using: sql`(user_id = app.current_user_id())`, withCheck: sql`(user_id = app.current_user_id())`  }),
	pgPolicy("devices_auth_all", { as: "permissive", for: "all", to: ["escala_auth"] }),
	pgPolicy("devices_worker_select", { as: "permissive", for: "select", to: ["escala_worker"] }),
	check("devices_label_check", sql`char_length(label) <= 60`),
]);

export const consents = pgTable("consents", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	purpose: text().notNull(),
	documentId: uuid("document_id"),
	granted: boolean().notNull(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("consents_document_idx").using("btree", table.documentId.asc().nullsLast().op("uuid_ops")),
	index("consents_user_idx").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.purpose.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.desc().nullsFirst().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "consents_user_id_fkey"
		}),
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [legalDocuments.id],
			name: "consents_document_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "consents_created_by_fkey"
		}),
	pgPolicy("consents_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`(user_id = app.current_user_id())` }),
	pgPolicy("consents_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("consents_auth_all", { as: "permissive", for: "all", to: ["escala_auth"] }),
]);

export const companyPrivateDetails = pgTable("company_private_details", {
	companyId: uuid("company_id").primaryKey().notNull(),
	legalNameEnc: text("legal_name_enc"),
	cnpjIndex: text("cnpj_index"),
	cnpjEnc: text("cnpj_enc"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "company_private_details_company_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "company_private_details_created_by_fkey"
		}),
	unique("company_private_details_cnpj_index_key").on(table.cnpjIndex),
	pgPolicy("company_private_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`app.is_company_member(company_id)` }),
	pgPolicy("company_private_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("company_private_app_update", { as: "permissive", for: "update", to: ["escala_app"] }),
	pgPolicy("company_private_support_select", { as: "permissive", for: "select", to: ["escala_support"] }),
	check("company_private_cnpj_pair", sql`(cnpj_index IS NULL) = (cnpj_enc IS NULL)`),
]);

export const companyMembers = pgTable("company_members", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	userId: uuid("user_id").notNull(),
	role: companyMemberRole().notNull(),
	invitedBy: uuid("invited_by"),
	acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("company_members_invited_by_idx").using("btree", table.invitedBy.asc().nullsLast().op("uuid_ops")),
	index("company_members_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "company_members_company_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "company_members_user_id_fkey"
		}),
	foreignKey({
			columns: [table.invitedBy],
			foreignColumns: [users.id],
			name: "company_members_invited_by_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "company_members_created_by_fkey"
		}),
	unique("company_members_company_id_user_id_key").on(table.companyId, table.userId),
	pgPolicy("company_members_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`((user_id = app.current_user_id()) OR app.is_company_member(company_id))` }),
	pgPolicy("company_members_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("company_members_app_update", { as: "permissive", for: "update", to: ["escala_app"] }),
	pgPolicy("company_members_app_delete", { as: "permissive", for: "delete", to: ["escala_app"] }),
	pgPolicy("company_members_support_select", { as: "permissive", for: "select", to: ["escala_support"] }),
]);

export const availabilitySlots = pgTable("availability_slots", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	freelancerId: uuid("freelancer_id").notNull(),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }).notNull(),
	endsAt: timestamp("ends_at", { withTimezone: true, mode: 'string' }).notNull(),
	recurrenceRule: text("recurrence_rule"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("availability_slots_freelancer_idx").using("btree", table.freelancerId.asc().nullsLast().op("timestamptz_ops"), table.startsAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.freelancerId],
			foreignColumns: [freelancerProfiles.userId],
			name: "availability_slots_freelancer_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "availability_slots_created_by_fkey"
		}),
	pgPolicy("availability_slots_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`app.can_view_freelancer(freelancer_id)` }),
	pgPolicy("availability_slots_app_write", { as: "permissive", for: "all", to: ["escala_app"] }),
	check("availability_valid_range", sql`ends_at > starts_at`),
]);

export const kycVerifications = pgTable("kyc_verifications", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	kind: kycKind().notNull(),
	provider: text().notNull(),
	providerRef: text("provider_ref"),
	status: verificationStatus().default('pending').notNull(),
	checkedAt: timestamp("checked_at", { withTimezone: true, mode: 'string' }),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("kyc_verifications_user_idx").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.kind.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "kyc_verifications_user_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "kyc_verifications_created_by_fkey"
		}),
	pgPolicy("kyc_verifications_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`(user_id = app.current_user_id())` }),
	pgPolicy("kyc_verifications_worker_all", { as: "permissive", for: "all", to: ["escala_worker"] }),
	pgPolicy("kyc_verifications_support_select", { as: "permissive", for: "select", to: ["escala_support"] }),
]);

export const checkIns = pgTable("check_ins", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	shiftId: uuid("shift_id").notNull(),
	kind: checkInKind().notNull(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	location: geography("location"),
	accuracyM: integer("accuracy_m"),
	withinGeofence: boolean("within_geofence").default(false).notNull(),
	source: checkInSource().default('device').notNull(),
	contested: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	foreignKey({
			columns: [table.shiftId],
			foreignColumns: [shifts.id],
			name: "check_ins_shift_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "check_ins_created_by_fkey"
		}),
	unique("check_ins_shift_id_kind_key").on(table.kind, table.shiftId),
	pgPolicy("check_ins_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`app.is_shift_party(shift_id)` }),
	pgPolicy("check_ins_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("check_ins_app_update", { as: "permissive", for: "update", to: ["escala_app"] }),
	check("check_ins_accuracy_m_check", sql`accuracy_m >= 0`),
]);

export const jobStatusHistory = pgTable("job_status_history", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	jobId: uuid("job_id").notNull(),
	fromStatus: jobStatus("from_status"),
	toStatus: jobStatus("to_status").notNull(),
	actorUserId: uuid("actor_user_id"),
	reason: text(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("job_status_history_actor_idx").using("btree", table.actorUserId.asc().nullsLast().op("uuid_ops")),
	index("job_status_history_job_idx").using("btree", table.jobId.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.jobId],
			foreignColumns: [jobs.id],
			name: "job_status_history_job_id_fkey"
		}),
	foreignKey({
			columns: [table.actorUserId],
			foreignColumns: [users.id],
			name: "job_status_history_actor_user_id_fkey"
		}),
	pgPolicy("job_status_history_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`app.is_company_member(app.job_company(job_id))` }),
	pgPolicy("job_status_history_support_select", { as: "permissive", for: "select", to: ["escala_support"] }),
]);

export const messageAttachments = pgTable("message_attachments", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	messageId: uuid("message_id").notNull(),
	fileId: uuid("file_id").notNull(),
	durationSeconds: integer("duration_seconds"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("message_attachments_file_idx").using("btree", table.fileId.asc().nullsLast().op("uuid_ops")),
	index("message_attachments_message_idx").using("btree", table.messageId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [messages.id],
			name: "message_attachments_message_id_fkey"
		}),
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [files.id],
			name: "message_attachments_file_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "message_attachments_created_by_fkey"
		}),
	pgPolicy("message_attachments_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`app.is_message_participant(message_id)` }),
	pgPolicy("message_attachments_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	check("message_attachments_duration_seconds_check", sql`(duration_seconds >= 1) AND (duration_seconds <= 300)`),
]);

export const applicationStatusHistory = pgTable("application_status_history", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	applicationId: uuid("application_id").notNull(),
	fromStatus: applicationStatus("from_status"),
	toStatus: applicationStatus("to_status").notNull(),
	actorUserId: uuid("actor_user_id"),
	reason: text(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("application_status_history_actor_idx").using("btree", table.actorUserId.asc().nullsLast().op("uuid_ops")),
	index("application_status_history_app_idx").using("btree", table.applicationId.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.applicationId],
			foreignColumns: [applications.id],
			name: "application_status_history_application_id_fkey"
		}),
	foreignKey({
			columns: [table.actorUserId],
			foreignColumns: [users.id],
			name: "application_status_history_actor_user_id_fkey"
		}),
	pgPolicy("application_status_history_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`app.is_application_party(application_id)` }),
	pgPolicy("application_status_history_support_select", { as: "permissive", for: "select", to: ["escala_support"] }),
]);

export const contractStatusHistory = pgTable("contract_status_history", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	contractId: uuid("contract_id").notNull(),
	fromStatus: contractStatus("from_status"),
	toStatus: contractStatus("to_status").notNull(),
	actorUserId: uuid("actor_user_id"),
	reason: text(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("contract_status_history_actor_idx").using("btree", table.actorUserId.asc().nullsLast().op("uuid_ops")),
	index("contract_status_history_contract_idx").using("btree", table.contractId.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.contractId],
			foreignColumns: [contracts.id],
			name: "contract_status_history_contract_id_fkey"
		}),
	foreignKey({
			columns: [table.actorUserId],
			foreignColumns: [users.id],
			name: "contract_status_history_actor_user_id_fkey"
		}),
	pgPolicy("contract_status_history_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`app.is_contract_party(contract_id)` }),
	pgPolicy("contract_status_history_support_select", { as: "permissive", for: "select", to: ["escala_support"] }),
]);

export const shiftStatusHistory = pgTable("shift_status_history", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	shiftId: uuid("shift_id").notNull(),
	fromStatus: shiftStatus("from_status"),
	toStatus: shiftStatus("to_status").notNull(),
	actorUserId: uuid("actor_user_id"),
	reason: text(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("shift_status_history_actor_idx").using("btree", table.actorUserId.asc().nullsLast().op("uuid_ops")),
	index("shift_status_history_shift_idx").using("btree", table.shiftId.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.shiftId],
			foreignColumns: [shifts.id],
			name: "shift_status_history_shift_id_fkey"
		}),
	foreignKey({
			columns: [table.actorUserId],
			foreignColumns: [users.id],
			name: "shift_status_history_actor_user_id_fkey"
		}),
	pgPolicy("shift_status_history_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`app.is_shift_party(shift_id)` }),
	pgPolicy("shift_status_history_support_select", { as: "permissive", for: "select", to: ["escala_support"] }),
]);

export const helpArticles = pgTable("help_articles", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	slug: text().notNull(),
	title: text().notNull(),
	body: text().notNull(),
	searchVector: tsvector("search_vector").generatedAlwaysAs(sql`to_tsvector('portuguese'::regconfig, ((title || ' '::text) || body))`),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("help_articles_search_idx").using("gin", table.searchVector.asc().nullsLast().op("tsvector_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "help_articles_created_by_fkey"
		}),
	unique("help_articles_slug_key").on(table.slug),
	pgPolicy("help_articles_read", { as: "permissive", for: "select", to: ["escala_app", "escala_auth"], using: sql`((published_at IS NOT NULL) AND (published_at <= now()))` }),
	pgPolicy("help_articles_support_all", { as: "permissive", for: "all", to: ["escala_support"] }),
]);

export const disputeStatusHistory = pgTable("dispute_status_history", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	disputeId: uuid("dispute_id").notNull(),
	fromStatus: disputeStatus("from_status"),
	toStatus: disputeStatus("to_status").notNull(),
	actorUserId: uuid("actor_user_id"),
	reason: text(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("dispute_status_history_actor_idx").using("btree", table.actorUserId.asc().nullsLast().op("uuid_ops")),
	index("dispute_status_history_dispute_idx").using("btree", table.disputeId.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.disputeId],
			foreignColumns: [disputes.id],
			name: "dispute_status_history_dispute_id_fkey"
		}),
	foreignKey({
			columns: [table.actorUserId],
			foreignColumns: [users.id],
			name: "dispute_status_history_actor_user_id_fkey"
		}),
	pgPolicy("dispute_status_history_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`app.is_dispute_party(dispute_id)` }),
	pgPolicy("dispute_status_history_support_select", { as: "permissive", for: "select", to: ["escala_support"] }),
]);

export const disputeEvidences = pgTable("dispute_evidences", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	disputeId: uuid("dispute_id").notNull(),
	submittedBy: uuid("submitted_by").notNull(),
	fileId: uuid("file_id"),
	noteEnc: text("note_enc"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("dispute_evidences_dispute_idx").using("btree", table.disputeId.asc().nullsLast().op("uuid_ops")),
	index("dispute_evidences_file_idx").using("btree", table.fileId.asc().nullsLast().op("uuid_ops")),
	index("dispute_evidences_submitter_idx").using("btree", table.submittedBy.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.disputeId],
			foreignColumns: [disputes.id],
			name: "dispute_evidences_dispute_id_fkey"
		}),
	foreignKey({
			columns: [table.submittedBy],
			foreignColumns: [users.id],
			name: "dispute_evidences_submitted_by_fkey"
		}),
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [files.id],
			name: "dispute_evidences_file_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "dispute_evidences_created_by_fkey"
		}),
	pgPolicy("dispute_evidences_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`(submitted_by = app.current_user_id())` }),
	pgPolicy("dispute_evidences_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("dispute_evidences_support_select", { as: "permissive", for: "select", to: ["escala_support"] }),
	check("dispute_evidences_has_content", sql`num_nonnulls(file_id, note_enc) >= 1`),
]);

export const reviews = pgTable("reviews", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	contractId: uuid("contract_id").notNull(),
	reviewerUserId: uuid("reviewer_user_id").notNull(),
	reviewerSide: reviewSide("reviewer_side").notNull(),
	subjectUserId: uuid("subject_user_id"),
	subjectCompanyId: uuid("subject_company_id"),
	comment: text(),
	status: reviewStatus().default('submitted').notNull(),
	revealedAt: timestamp("revealed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("reviews_pending_reveal_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(revealed_at IS NULL)`),
	index("reviews_reviewer_idx").using("btree", table.reviewerUserId.asc().nullsLast().op("uuid_ops")),
	index("reviews_subject_company_idx").using("btree", table.subjectCompanyId.asc().nullsLast().op("timestamptz_ops"), table.revealedAt.asc().nullsLast().op("timestamptz_ops")),
	index("reviews_subject_user_idx").using("btree", table.subjectUserId.asc().nullsLast().op("timestamptz_ops"), table.revealedAt.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.contractId],
			foreignColumns: [contracts.id],
			name: "reviews_contract_id_fkey"
		}),
	foreignKey({
			columns: [table.reviewerUserId],
			foreignColumns: [users.id],
			name: "reviews_reviewer_user_id_fkey"
		}),
	foreignKey({
			columns: [table.subjectUserId],
			foreignColumns: [users.id],
			name: "reviews_subject_user_id_fkey"
		}),
	foreignKey({
			columns: [table.subjectCompanyId],
			foreignColumns: [companies.id],
			name: "reviews_subject_company_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "reviews_created_by_fkey"
		}),
	unique("reviews_contract_id_reviewer_side_key").on(table.contractId, table.reviewerSide),
	pgPolicy("reviews_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`((reviewer_user_id = app.current_user_id()) OR ((app.current_user_id() IS NOT NULL) AND (revealed_at IS NOT NULL) AND (status = 'published'::review_status)))` }),
	pgPolicy("reviews_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("reviews_worker_all", { as: "permissive", for: "all", to: ["escala_worker"] }),
	pgPolicy("reviews_support_all", { as: "permissive", for: "all", to: ["escala_support"] }),
	check("reviews_comment_check", sql`char_length(comment) <= 1000`),
	check("reviews_one_subject", sql`num_nonnulls(subject_user_id, subject_company_id) = 1`),
	check("reviews_published_is_revealed", sql`(status <> 'published'::review_status) OR (revealed_at IS NOT NULL)`),
]);

export const jobPrivateDetails = pgTable("job_private_details", {
	jobId: uuid("job_id").primaryKey().notNull(),
	addressEnc: text("address_enc"),
	siteLocation: geography("site_location"),
	checkinRadiusM: integer("checkin_radius_m").default(200).notNull(),
	accessNotesEnc: text("access_notes_enc"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	foreignKey({
			columns: [table.jobId],
			foreignColumns: [jobs.id],
			name: "job_private_details_job_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "job_private_details_created_by_fkey"
		}),
	pgPolicy("job_private_details_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`(app.is_company_member(app.job_company(job_id)) OR app.has_visible_contract_for_job(job_id))` }),
	pgPolicy("job_private_details_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("job_private_details_app_update", { as: "permissive", for: "update", to: ["escala_app"] }),
	check("job_private_details_checkin_radius_m_check", sql`(checkin_radius_m >= 50) AND (checkin_radius_m <= 2000)`),
]);

export const jobRequirements = pgTable("job_requirements", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	jobId: uuid("job_id").notNull(),
	skillId: uuid("skill_id").notNull(),
	minLevel: skillLevel("min_level"),
	note: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("job_requirements_skill_idx").using("btree", table.skillId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.jobId],
			foreignColumns: [jobs.id],
			name: "job_requirements_job_id_fkey"
		}),
	foreignKey({
			columns: [table.skillId],
			foreignColumns: [skills.id],
			name: "job_requirements_skill_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "job_requirements_created_by_fkey"
		}),
	unique("job_requirements_job_id_skill_id_key").on(table.jobId, table.skillId),
	pgPolicy("job_requirements_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`app.can_read_job(job_id)` }),
	pgPolicy("job_requirements_app_write", { as: "permissive", for: "all", to: ["escala_app"] }),
	check("job_requirements_note_check", sql`char_length(note) <= 300`),
]);

export const conversations = pgTable("conversations", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	applicationId: uuid("application_id").notNull(),
	status: conversationStatus().default('open').notNull(),
	lastMessageAt: timestamp("last_message_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	foreignKey({
			columns: [table.applicationId],
			foreignColumns: [applications.id],
			name: "conversations_application_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "conversations_created_by_fkey"
		}),
	unique("conversations_application_id_key").on(table.applicationId),
	pgPolicy("conversations_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`app.is_conversation_participant(id)` }),
]);

export const messages = pgTable("messages", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	conversationId: uuid("conversation_id").notNull(),
	senderUserId: uuid("sender_user_id"),
	kind: messageKind().default('text').notNull(),
	bodyEnc: text("body_enc"),
	contactMasked: boolean("contact_masked").default(false).notNull(),
	status: messageStatus().default('visible').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("messages_conversation_idx").using("btree", table.conversationId.asc().nullsLast().op("uuid_ops"), table.id.desc().nullsFirst().op("uuid_ops")),
	index("messages_sender_idx").using("btree", table.senderUserId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "messages_conversation_id_fkey"
		}),
	foreignKey({
			columns: [table.senderUserId],
			foreignColumns: [users.id],
			name: "messages_sender_user_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "messages_created_by_fkey"
		}),
	pgPolicy("messages_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`(app.is_conversation_participant(conversation_id) AND ((status = 'visible'::message_status) OR (sender_user_id = app.current_user_id())))` }),
	pgPolicy("messages_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("messages_app_update", { as: "permissive", for: "update", to: ["escala_app"] }),
	check("messages_system_has_no_sender", sql`(kind = 'system'::message_kind) = (sender_user_id IS NULL)`),
]);

export const notifications = pgTable("notifications", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	type: text().notNull(),
	payload: jsonb().default({}).notNull(),
	sentAt: timestamp("sent_at", { withTimezone: true, mode: 'string' }),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("notifications_unread_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")).where(sql`(read_at IS NULL)`),
	index("notifications_user_idx").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notifications_user_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "notifications_created_by_fkey"
		}),
	pgPolicy("notifications_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`(user_id = app.current_user_id())` }),
	pgPolicy("notifications_app_update", { as: "permissive", for: "update", to: ["escala_app"] }),
	pgPolicy("notifications_worker_all", { as: "permissive", for: "all", to: ["escala_worker"] }),
]);

export const files = pgTable("files", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	ownerUserId: uuid("owner_user_id").notNull(),
	storageKey: text("storage_key").notNull(),
	mimeType: text("mime_type").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
	sha256: text().notNull(),
	scanStatus: fileScanStatus("scan_status").default('pending').notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("files_owner_idx").using("btree", table.ownerUserId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.ownerUserId],
			foreignColumns: [users.id],
			name: "files_owner_user_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "files_created_by_fkey"
		}),
	unique("files_storage_key_key").on(table.storageKey),
	pgPolicy("files_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`((owner_user_id = app.current_user_id()) OR app.can_read_file(id))` }),
	pgPolicy("files_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("files_app_update", { as: "permissive", for: "update", to: ["escala_app"] }),
	pgPolicy("files_worker_all", { as: "permissive", for: "all", to: ["escala_worker"] }),
	pgPolicy("files_support_select", { as: "permissive", for: "select", to: ["escala_support"] }),
	check("files_size_bytes_check", sql`size_bytes > 0`),
	check("files_sha256_check", sql`sha256 ~ '^[0-9a-f]{64}$'::text`),
]);

export const freelancerProfiles = pgTable("freelancer_profiles", {
	userId: uuid("user_id").primaryKey().notNull(),
	displayName: text("display_name").notNull(),
	photoFileId: uuid("photo_file_id"),
	bio: text().default('').notNull(),
	experienceYears: integer("experience_years").default(0).notNull(),
	referenceRateCents: moneyCents("reference_rate_cents"),
	currency: currencyCode("currency").notNull(),
	baseLocation: geography("base_location"),
	serviceRadiusKm: integer("service_radius_km").default(25).notNull(),
	availableNow: boolean("available_now").default(false).notNull(),
	discoverable: boolean().default(false).notNull(),
	status: profileStatus().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("freelancer_profiles_location_idx").using("gist", table.baseLocation.asc().nullsLast().op("gist_geography_ops")).where(sql`(discoverable AND (status = 'active'::profile_status))`),
	index("freelancer_profiles_photo_idx").using("btree", table.photoFileId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "freelancer_profiles_user_id_fkey"
		}),
	foreignKey({
			columns: [table.photoFileId],
			foreignColumns: [files.id],
			name: "freelancer_profiles_photo_file_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "freelancer_profiles_created_by_fkey"
		}),
	pgPolicy("freelancer_profiles_worker_select", { as: "permissive", for: "select", to: ["escala_worker"], using: sql`true` }),
	pgPolicy("freelancer_profiles_support_select", { as: "permissive", for: "select", to: ["escala_support"] }),
	pgPolicy("freelancer_profiles_app_select", { as: "permissive", for: "select", to: ["escala_app"] }),
	pgPolicy("freelancer_profiles_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("freelancer_profiles_app_update", { as: "permissive", for: "update", to: ["escala_app"] }),
	check("freelancer_profiles_display_name_check", sql`(char_length(display_name) >= 2) AND (char_length(display_name) <= 60)`),
	check("freelancer_profiles_bio_check", sql`char_length(bio) <= 1000`),
	check("freelancer_profiles_experience_years_check", sql`(experience_years >= 0) AND (experience_years <= 60)`),
	check("freelancer_profiles_service_radius_km_check", sql`(service_radius_km >= 1) AND (service_radius_km <= 500)`),
]);

export const portfolioItems = pgTable("portfolio_items", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	freelancerId: uuid("freelancer_id").notNull(),
	title: text().notNull(),
	fileId: uuid("file_id"),
	externalUrl: text("external_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("portfolio_items_file_idx").using("btree", table.fileId.asc().nullsLast().op("uuid_ops")),
	index("portfolio_items_freelancer_idx").using("btree", table.freelancerId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.freelancerId],
			foreignColumns: [freelancerProfiles.userId],
			name: "portfolio_items_freelancer_id_fkey"
		}),
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [files.id],
			name: "portfolio_items_file_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "portfolio_items_created_by_fkey"
		}),
	pgPolicy("portfolio_items_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`app.can_view_freelancer(freelancer_id)` }),
	pgPolicy("portfolio_items_app_write", { as: "permissive", for: "all", to: ["escala_app"] }),
	pgPolicy("portfolio_items_support_select", { as: "permissive", for: "select", to: ["escala_support"] }),
	check("portfolio_items_title_check", sql`char_length(title) <= 120`),
	check("portfolio_items_external_url_check", sql`(external_url IS NULL) OR (external_url ~ '^https://'::text)`),
	check("portfolio_has_content", sql`num_nonnulls(file_id, external_url) >= 1`),
]);

export const applications = pgTable("applications", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	jobId: uuid("job_id").notNull(),
	freelancerId: uuid("freelancer_id").notNull(),
	origin: applicationOrigin().notNull(),
	status: applicationStatus().notNull(),
	noteEnc: text("note_enc"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("applications_freelancer_idx").using("btree", table.freelancerId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("applications_job_status_idx").using("btree", table.jobId.asc().nullsLast().op("enum_ops"), table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.jobId],
			foreignColumns: [jobs.id],
			name: "applications_job_id_fkey"
		}),
	foreignKey({
			columns: [table.freelancerId],
			foreignColumns: [freelancerProfiles.userId],
			name: "applications_freelancer_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "applications_created_by_fkey"
		}),
	unique("applications_job_id_freelancer_id_key").on(table.freelancerId, table.jobId),
	unique("applications_id_job_id_freelancer_id_key").on(table.freelancerId, table.id, table.jobId),
	pgPolicy("applications_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`((freelancer_id = app.current_user_id()) OR ((status <> 'withdrawn'::application_status) AND app.is_company_member(app.job_company(job_id))))` }),
	pgPolicy("applications_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("applications_app_update", { as: "permissive", for: "update", to: ["escala_app"] }),
	pgPolicy("applications_worker_all", { as: "permissive", for: "all", to: ["escala_worker"] }),
	pgPolicy("applications_support_select", { as: "permissive", for: "select", to: ["escala_support"] }),
]);

export const shifts = pgTable("shifts", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	contractId: uuid("contract_id").notNull(),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }).notNull(),
	endsAt: timestamp("ends_at", { withTimezone: true, mode: 'string' }).notNull(),
	status: shiftStatus().default('scheduled').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("shifts_contract_idx").using("btree", table.contractId.asc().nullsLast().op("timestamptz_ops"), table.startsAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.contractId],
			foreignColumns: [contracts.id],
			name: "shifts_contract_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "shifts_created_by_fkey"
		}),
	pgPolicy("shifts_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`app.is_contract_party(contract_id)` }),
	pgPolicy("shifts_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("shifts_app_update", { as: "permissive", for: "update", to: ["escala_app"] }),
	pgPolicy("shifts_worker_all", { as: "permissive", for: "all", to: ["escala_worker"] }),
	pgPolicy("shifts_support_select", { as: "permissive", for: "select", to: ["escala_support"] }),
	check("shifts_valid_range", sql`ends_at > starts_at`),
]);

export const reputationSnapshots = pgTable("reputation_snapshots", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	subjectUserId: uuid("subject_user_id"),
	subjectCompanyId: uuid("subject_company_id"),
	bayesianScore: numeric("bayesian_score", { precision: 4, scale:  3 }),
	reviewCount: integer("review_count").default(0).notNull(),
	metrics: jsonb().default({}).notNull(),
	computedAt: timestamp("computed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("reputation_snapshots_company_idx").using("btree", table.subjectCompanyId.asc().nullsLast().op("timestamptz_ops"), table.computedAt.desc().nullsFirst().op("uuid_ops")),
	index("reputation_snapshots_user_idx").using("btree", table.subjectUserId.asc().nullsLast().op("uuid_ops"), table.computedAt.desc().nullsFirst().op("uuid_ops")),
	foreignKey({
			columns: [table.subjectUserId],
			foreignColumns: [users.id],
			name: "reputation_snapshots_subject_user_id_fkey"
		}),
	foreignKey({
			columns: [table.subjectCompanyId],
			foreignColumns: [companies.id],
			name: "reputation_snapshots_subject_company_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "reputation_snapshots_created_by_fkey"
		}),
	pgPolicy("reputation_snapshots_read", { as: "permissive", for: "select", to: ["escala_app", "escala_support"], using: sql`(app.current_user_id() IS NOT NULL)` }),
	pgPolicy("reputation_snapshots_worker_all", { as: "permissive", for: "all", to: ["escala_worker"] }),
	check("reputation_snapshots_review_count_check", sql`review_count >= 0`),
	check("reputation_snapshots_one_subject", sql`num_nonnulls(subject_user_id, subject_company_id) = 1`),
]);

export const userBadges = pgTable("user_badges", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	badgeId: uuid("badge_id").notNull(),
	subjectUserId: uuid("subject_user_id"),
	subjectCompanyId: uuid("subject_company_id"),
	awardedAt: timestamp("awarded_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("user_badges_badge_idx").using("btree", table.badgeId.asc().nullsLast().op("uuid_ops")),
	index("user_badges_company_idx").using("btree", table.subjectCompanyId.asc().nullsLast().op("uuid_ops")),
	index("user_badges_user_idx").using("btree", table.subjectUserId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.badgeId],
			foreignColumns: [badges.id],
			name: "user_badges_badge_id_fkey"
		}),
	foreignKey({
			columns: [table.subjectUserId],
			foreignColumns: [users.id],
			name: "user_badges_subject_user_id_fkey"
		}),
	foreignKey({
			columns: [table.subjectCompanyId],
			foreignColumns: [companies.id],
			name: "user_badges_subject_company_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "user_badges_created_by_fkey"
		}),
	pgPolicy("user_badges_read", { as: "permissive", for: "select", to: ["escala_app", "escala_support"], using: sql`(app.current_user_id() IS NOT NULL)` }),
	pgPolicy("user_badges_worker_all", { as: "permissive", for: "all", to: ["escala_worker"] }),
	check("user_badges_one_subject", sql`num_nonnulls(subject_user_id, subject_company_id) = 1`),
]);

export const ticketStatusHistory = pgTable("ticket_status_history", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	ticketId: uuid("ticket_id").notNull(),
	fromStatus: ticketStatus("from_status"),
	toStatus: ticketStatus("to_status").notNull(),
	actorUserId: uuid("actor_user_id"),
	reason: text(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ticket_status_history_actor_idx").using("btree", table.actorUserId.asc().nullsLast().op("uuid_ops")),
	index("ticket_status_history_ticket_idx").using("btree", table.ticketId.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.ticketId],
			foreignColumns: [supportTickets.id],
			name: "ticket_status_history_ticket_id_fkey"
		}),
	foreignKey({
			columns: [table.actorUserId],
			foreignColumns: [users.id],
			name: "ticket_status_history_actor_user_id_fkey"
		}),
	pgPolicy("ticket_status_history_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`app.is_ticket_requester(ticket_id)` }),
	pgPolicy("ticket_status_history_support_select", { as: "permissive", for: "select", to: ["escala_support"] }),
]);

export const legalDocuments = pgTable("legal_documents", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	kind: legalDocumentKind().notNull(),
	version: text().notNull(),
	contentSha256: text("content_sha256").notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "legal_documents_created_by_fkey"
		}),
	unique("legal_documents_kind_version_key").on(table.kind, table.version),
	pgPolicy("legal_documents_read", { as: "permissive", for: "select", to: ["escala_app", "escala_auth", "escala_support", "escala_worker"], using: sql`true` }),
	pgPolicy("legal_documents_support_write", { as: "permissive", for: "insert", to: ["escala_support"] }),
	check("legal_documents_content_sha256_check", sql`content_sha256 ~ '^[0-9a-f]{64}$'::text`),
]);

export const companyVerifications = pgTable("company_verifications", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	method: verificationMethod().notNull(),
	status: verificationStatus().default('pending').notNull(),
	providerRef: text("provider_ref"),
	checkedAt: timestamp("checked_at", { withTimezone: true, mode: 'string' }),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("company_verifications_company_idx").using("btree", table.companyId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "company_verifications_company_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "company_verifications_created_by_fkey"
		}),
	pgPolicy("company_verifications_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`app.is_company_member(company_id)` }),
	pgPolicy("company_verifications_worker_all", { as: "permissive", for: "all", to: ["escala_worker"] }),
	pgPolicy("company_verifications_support_all", { as: "permissive", for: "all", to: ["escala_support"] }),
]);

export const jobs = pgTable("jobs", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	title: text().notNull(),
	description: text().notNull(),
	primarySkillId: uuid("primary_skill_id").notNull(),
	city: text().notNull(),
	neighbourhood: text().notNull(),
	publicLocation: geography("public_location").notNull(),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }).notNull(),
	endsAt: timestamp("ends_at", { withTimezone: true, mode: 'string' }).notNull(),
	slots: integer().default(1).notNull(),
	payAmountCents: moneyCents("pay_amount_cents").notNull(),
	currency: currencyCode("currency").notNull(),
	payUnit: payUnit("pay_unit").notNull(),
	status: jobStatus().default('draft').notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("jobs_company_idx").using("btree", table.companyId.asc().nullsLast().op("timestamptz_ops"), table.startsAt.desc().nullsFirst().op("uuid_ops")),
	index("jobs_location_idx").using("gist", table.publicLocation.asc().nullsLast().op("gist_geography_ops")).where(sql`(status = 'published'::job_status)`),
	index("jobs_skill_idx").using("btree", table.primarySkillId.asc().nullsLast().op("uuid_ops")),
	index("jobs_status_date_idx").using("btree", table.status.asc().nullsLast().op("timestamptz_ops"), table.startsAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "jobs_company_id_fkey"
		}),
	foreignKey({
			columns: [table.primarySkillId],
			foreignColumns: [skills.id],
			name: "jobs_primary_skill_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "jobs_created_by_fkey"
		}),
	unique("jobs_id_company_id_key").on(table.companyId, table.id),
	pgPolicy("jobs_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`(((app.current_user_id() IS NOT NULL) AND (status = 'published'::job_status) AND (deleted_at IS NULL)) OR app.is_company_member(company_id) OR app.has_application_for_job(id))` }),
	pgPolicy("jobs_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("jobs_app_update", { as: "permissive", for: "update", to: ["escala_app"] }),
	pgPolicy("jobs_worker_all", { as: "permissive", for: "all", to: ["escala_worker"] }),
	pgPolicy("jobs_support_all", { as: "permissive", for: "all", to: ["escala_support"] }),
	check("jobs_title_check", sql`(char_length(title) >= 4) AND (char_length(title) <= 120)`),
	check("jobs_description_check", sql`(char_length(description) >= 10) AND (char_length(description) <= 2000)`),
	check("jobs_slots_check", sql`(slots >= 1) AND (slots <= 50)`),
	check("jobs_valid_range", sql`ends_at > starts_at`),
]);

export const documents = pgTable("documents", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	kind: documentKind().notNull(),
	fileId: uuid("file_id").notNull(),
	status: documentStatus().default('pending').notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("documents_file_idx").using("btree", table.fileId.asc().nullsLast().op("uuid_ops")),
	index("documents_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "documents_user_id_fkey"
		}),
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [files.id],
			name: "documents_file_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "documents_created_by_fkey"
		}),
	pgPolicy("documents_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`(user_id = app.current_user_id())` }),
	pgPolicy("documents_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("documents_app_delete", { as: "permissive", for: "delete", to: ["escala_app"] }),
	pgPolicy("documents_support_all", { as: "permissive", for: "all", to: ["escala_support"] }),
]);

export const dataRequests = pgTable("data_requests", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	kind: dataRequestKind().notNull(),
	status: dataRequestStatus().default('pending').notNull(),
	fileId: uuid("file_id"),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("data_requests_file_idx").using("btree", table.fileId.asc().nullsLast().op("uuid_ops")),
	index("data_requests_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "data_requests_user_id_fkey"
		}),
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [files.id],
			name: "data_requests_file_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "data_requests_created_by_fkey"
		}),
	pgPolicy("data_requests_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`(user_id = app.current_user_id())` }),
	pgPolicy("data_requests_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("data_requests_worker_all", { as: "permissive", for: "all", to: ["escala_worker"] }),
	pgPolicy("data_requests_support_all", { as: "permissive", for: "all", to: ["escala_support"] }),
]);

export const skills = pgTable("skills", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	category: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "skills_created_by_fkey"
		}),
	unique("skills_slug_key").on(table.slug),
	pgPolicy("skills_read", { as: "permissive", for: "select", to: ["escala_app", "escala_support", "escala_worker"], using: sql`true` }),
	pgPolicy("skills_support_write", { as: "permissive", for: "all", to: ["escala_support"] }),
]);

export const badges = pgTable("badges", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	criteria: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "badges_created_by_fkey"
		}),
	unique("badges_slug_key").on(table.slug),
	pgPolicy("badges_read", { as: "permissive", for: "select", to: ["escala_app", "escala_worker"], using: sql`true` }),
	pgPolicy("badges_support_all", { as: "permissive", for: "all", to: ["escala_support"] }),
]);

export const supportTickets = pgTable("support_tickets", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	requesterUserId: uuid("requester_user_id").notNull(),
	contractId: uuid("contract_id"),
	category: ticketCategory().notNull(),
	priority: ticketPriority().default('normal').notNull(),
	status: ticketStatus().default('open').notNull(),
	assigneeUserId: uuid("assignee_user_id"),
	slaDueAt: timestamp("sla_due_at", { withTimezone: true, mode: 'string' }),
	satisfactionScore: smallint("satisfaction_score"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("support_tickets_assignee_idx").using("btree", table.assigneeUserId.asc().nullsLast().op("uuid_ops")),
	index("support_tickets_contract_idx").using("btree", table.contractId.asc().nullsLast().op("uuid_ops")),
	index("support_tickets_queue_idx").using("btree", table.status.asc().nullsLast().op("timestamptz_ops"), table.priority.asc().nullsLast().op("enum_ops"), table.slaDueAt.asc().nullsLast().op("enum_ops")),
	index("support_tickets_requester_idx").using("btree", table.requesterUserId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	foreignKey({
			columns: [table.requesterUserId],
			foreignColumns: [users.id],
			name: "support_tickets_requester_user_id_fkey"
		}),
	foreignKey({
			columns: [table.contractId],
			foreignColumns: [contracts.id],
			name: "support_tickets_contract_id_fkey"
		}),
	foreignKey({
			columns: [table.assigneeUserId],
			foreignColumns: [users.id],
			name: "support_tickets_assignee_user_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "support_tickets_created_by_fkey"
		}),
	pgPolicy("support_tickets_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`(requester_user_id = app.current_user_id())` }),
	pgPolicy("support_tickets_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("support_tickets_app_update", { as: "permissive", for: "update", to: ["escala_app"] }),
	pgPolicy("support_tickets_support_all", { as: "permissive", for: "all", to: ["escala_support"] }),
	check("support_tickets_satisfaction_score_check", sql`(satisfaction_score >= 1) AND (satisfaction_score <= 5)`),
]);

export const ticketMessages = pgTable("ticket_messages", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	ticketId: uuid("ticket_id").notNull(),
	authorUserId: uuid("author_user_id"),
	bodyEnc: text("body_enc"),
	fileId: uuid("file_id"),
	internalNote: boolean("internal_note").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("ticket_messages_author_idx").using("btree", table.authorUserId.asc().nullsLast().op("uuid_ops")),
	index("ticket_messages_file_idx").using("btree", table.fileId.asc().nullsLast().op("uuid_ops")),
	index("ticket_messages_ticket_idx").using("btree", table.ticketId.asc().nullsLast().op("uuid_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.ticketId],
			foreignColumns: [supportTickets.id],
			name: "ticket_messages_ticket_id_fkey"
		}),
	foreignKey({
			columns: [table.authorUserId],
			foreignColumns: [users.id],
			name: "ticket_messages_author_user_id_fkey"
		}),
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [files.id],
			name: "ticket_messages_file_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "ticket_messages_created_by_fkey"
		}),
	pgPolicy("ticket_messages_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`((NOT internal_note) AND app.is_ticket_requester(ticket_id))` }),
	pgPolicy("ticket_messages_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("ticket_messages_support_all", { as: "permissive", for: "all", to: ["escala_support"] }),
]);

export const disputes = pgTable("disputes", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	contractId: uuid("contract_id").notNull(),
	ticketId: uuid("ticket_id"),
	openedBy: uuid("opened_by").notNull(),
	reason: disputeReason().notNull(),
	status: disputeStatus().default('opened').notNull(),
	evidenceDueAt: timestamp("evidence_due_at", { withTimezone: true, mode: 'string' }),
	decision: disputeDecision(),
	decisionNotes: text("decision_notes"),
	decidedBy: uuid("decided_by"),
	appliedAt: timestamp("applied_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("disputes_contract_idx").using("btree", table.contractId.asc().nullsLast().op("uuid_ops")),
	index("disputes_decided_by_idx").using("btree", table.decidedBy.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("disputes_one_open_idx").using("btree", table.contractId.asc().nullsLast().op("uuid_ops")).where(sql`(status <> ALL (ARRAY['closed'::dispute_status, 'withdrawn'::dispute_status]))`),
	index("disputes_opened_by_idx").using("btree", table.openedBy.asc().nullsLast().op("uuid_ops")),
	index("disputes_queue_idx").using("btree", table.status.asc().nullsLast().op("timestamptz_ops"), table.evidenceDueAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.contractId],
			foreignColumns: [contracts.id],
			name: "disputes_contract_id_fkey"
		}),
	foreignKey({
			columns: [table.ticketId],
			foreignColumns: [supportTickets.id],
			name: "disputes_ticket_id_fkey"
		}),
	foreignKey({
			columns: [table.openedBy],
			foreignColumns: [users.id],
			name: "disputes_opened_by_fkey"
		}),
	foreignKey({
			columns: [table.decidedBy],
			foreignColumns: [users.id],
			name: "disputes_decided_by_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "disputes_created_by_fkey"
		}),
	unique("disputes_ticket_id_key").on(table.ticketId),
	pgPolicy("disputes_app_insert", { as: "permissive", for: "insert", to: ["escala_app"], withCheck: sql`app.is_contract_party(contract_id)`  }),
	pgPolicy("disputes_app_select", { as: "permissive", for: "select", to: ["escala_app"] }),
	pgPolicy("disputes_app_update", { as: "permissive", for: "update", to: ["escala_app"] }),
	pgPolicy("disputes_worker_all", { as: "permissive", for: "all", to: ["escala_worker"] }),
	pgPolicy("disputes_support_all", { as: "permissive", for: "all", to: ["escala_support"] }),
	check("disputes_decision_consistent", sql`(status <> ALL (ARRAY['decided'::dispute_status, 'applied'::dispute_status, 'closed'::dispute_status])) OR (decision IS NOT NULL) OR (status = 'closed'::dispute_status)`),
]);

export const safetyAlerts = pgTable("safety_alerts", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	shiftId: uuid("shift_id"),
	location: geography("location"),
	status: safetyAlertStatus().default('open').notNull(),
	handledBy: uuid("handled_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("safety_alerts_handled_idx").using("btree", table.handledBy.asc().nullsLast().op("uuid_ops")),
	index("safety_alerts_queue_idx").using("btree", table.status.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("enum_ops")),
	index("safety_alerts_shift_idx").using("btree", table.shiftId.asc().nullsLast().op("uuid_ops")),
	index("safety_alerts_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "safety_alerts_user_id_fkey"
		}),
	foreignKey({
			columns: [table.shiftId],
			foreignColumns: [shifts.id],
			name: "safety_alerts_shift_id_fkey"
		}),
	foreignKey({
			columns: [table.handledBy],
			foreignColumns: [users.id],
			name: "safety_alerts_handled_by_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "safety_alerts_created_by_fkey"
		}),
	pgPolicy("safety_alerts_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`(user_id = app.current_user_id())` }),
	pgPolicy("safety_alerts_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("safety_alerts_support_all", { as: "permissive", for: "all", to: ["escala_support"] }),
]);

export const messageReports = pgTable("message_reports", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	messageId: uuid("message_id").notNull(),
	reporterUserId: uuid("reporter_user_id").notNull(),
	reason: reportReason().notNull(),
	status: reportStatus().default('open').notNull(),
	resolvedBy: uuid("resolved_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("message_reports_queue_idx").using("btree", table.status.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("enum_ops")),
	index("message_reports_reporter_idx").using("btree", table.reporterUserId.asc().nullsLast().op("uuid_ops")),
	index("message_reports_resolved_idx").using("btree", table.resolvedBy.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [messages.id],
			name: "message_reports_message_id_fkey"
		}),
	foreignKey({
			columns: [table.reporterUserId],
			foreignColumns: [users.id],
			name: "message_reports_reporter_user_id_fkey"
		}),
	foreignKey({
			columns: [table.resolvedBy],
			foreignColumns: [users.id],
			name: "message_reports_resolved_by_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "message_reports_created_by_fkey"
		}),
	unique("message_reports_message_id_reporter_user_id_key").on(table.messageId, table.reporterUserId),
	pgPolicy("message_reports_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`(reporter_user_id = app.current_user_id())` }),
	pgPolicy("message_reports_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("message_reports_support_all", { as: "permissive", for: "all", to: ["escala_support"] }),
]);

export const reviewReplies = pgTable("review_replies", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	reviewId: uuid("review_id").notNull(),
	authorUserId: uuid("author_user_id").notNull(),
	body: text().notNull(),
	status: replyStatus().default('published').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("review_replies_author_idx").using("btree", table.authorUserId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.reviewId],
			foreignColumns: [reviews.id],
			name: "review_replies_review_id_fkey"
		}),
	foreignKey({
			columns: [table.authorUserId],
			foreignColumns: [users.id],
			name: "review_replies_author_user_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "review_replies_created_by_fkey"
		}),
	unique("review_replies_review_id_key").on(table.reviewId),
	pgPolicy("review_replies_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`((author_user_id = app.current_user_id()) OR ((status = 'published'::reply_status) AND app.can_read_review(review_id)))` }),
	pgPolicy("review_replies_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("review_replies_support_all", { as: "permissive", for: "all", to: ["escala_support"] }),
	check("review_replies_body_check", sql`(char_length(body) >= 1) AND (char_length(body) <= 1000)`),
]);

export const penalties = pgTable("penalties", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	ruleId: uuid("rule_id").notNull(),
	subjectUserId: uuid("subject_user_id"),
	subjectCompanyId: uuid("subject_company_id"),
	contractId: uuid("contract_id"),
	status: penaltyStatus().default('active').notNull(),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	endsAt: timestamp("ends_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("penalties_company_idx").using("btree", table.subjectCompanyId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("enum_ops")),
	index("penalties_contract_idx").using("btree", table.contractId.asc().nullsLast().op("uuid_ops")),
	index("penalties_rule_idx").using("btree", table.ruleId.asc().nullsLast().op("uuid_ops")),
	index("penalties_user_idx").using("btree", table.subjectUserId.asc().nullsLast().op("enum_ops"), table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.ruleId],
			foreignColumns: [reputationRules.id],
			name: "penalties_rule_id_fkey"
		}),
	foreignKey({
			columns: [table.subjectUserId],
			foreignColumns: [users.id],
			name: "penalties_subject_user_id_fkey"
		}),
	foreignKey({
			columns: [table.subjectCompanyId],
			foreignColumns: [companies.id],
			name: "penalties_subject_company_id_fkey"
		}),
	foreignKey({
			columns: [table.contractId],
			foreignColumns: [contracts.id],
			name: "penalties_contract_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "penalties_created_by_fkey"
		}),
	pgPolicy("penalties_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`((subject_user_id = app.current_user_id()) OR ((subject_company_id IS NOT NULL) AND app.is_company_member(subject_company_id)))` }),
	pgPolicy("penalties_worker_all", { as: "permissive", for: "all", to: ["escala_worker"] }),
	pgPolicy("penalties_support_all", { as: "permissive", for: "all", to: ["escala_support"] }),
	check("penalties_one_subject", sql`num_nonnulls(subject_user_id, subject_company_id) = 1`),
	check("penalties_valid_range", sql`(ends_at IS NULL) OR (ends_at > starts_at)`),
]);

export const penaltyAppeals = pgTable("penalty_appeals", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	penaltyId: uuid("penalty_id").notNull(),
	submittedBy: uuid("submitted_by").notNull(),
	body: text().notNull(),
	status: appealStatus().default('open').notNull(),
	decidedBy: uuid("decided_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("penalty_appeals_decider_idx").using("btree", table.decidedBy.asc().nullsLast().op("uuid_ops")),
	index("penalty_appeals_penalty_idx").using("btree", table.penaltyId.asc().nullsLast().op("uuid_ops")),
	index("penalty_appeals_submitter_idx").using("btree", table.submittedBy.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.penaltyId],
			foreignColumns: [penalties.id],
			name: "penalty_appeals_penalty_id_fkey"
		}),
	foreignKey({
			columns: [table.submittedBy],
			foreignColumns: [users.id],
			name: "penalty_appeals_submitted_by_fkey"
		}),
	foreignKey({
			columns: [table.decidedBy],
			foreignColumns: [users.id],
			name: "penalty_appeals_decided_by_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "penalty_appeals_created_by_fkey"
		}),
	pgPolicy("penalty_appeals_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`(submitted_by = app.current_user_id())` }),
	pgPolicy("penalty_appeals_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("penalty_appeals_support_all", { as: "permissive", for: "all", to: ["escala_support"] }),
	check("penalty_appeals_body_check", sql`(char_length(body) >= 1) AND (char_length(body) <= 2000)`),
]);

export const contracts = pgTable("contracts", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	applicationId: uuid("application_id").notNull(),
	jobId: uuid("job_id").notNull(),
	companyId: uuid("company_id").notNull(),
	freelancerId: uuid("freelancer_id").notNull(),
	companyContactUserId: uuid("company_contact_user_id").notNull(),
	termsDocumentId: uuid("terms_document_id").notNull(),
	agreedAmountCents: moneyCents("agreed_amount_cents").notNull(),
	currency: currencyCode("currency").notNull(),
	payUnit: payUnit("pay_unit").notNull(),
	status: contractStatus().default('proposed').notNull(),
	cancelledBy: contractParty("cancelled_by"),
	noShowParty: contractParty("no_show_party"),
	acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: 'string' }),
	contactVisibleUntil: timestamp("contact_visible_until", { withTimezone: true, mode: 'string' }),
	paymentDueOn: date("payment_due_on"),
	companyMarkedPaidAt: timestamp("company_marked_paid_at", { withTimezone: true, mode: 'string' }),
	freelancerConfirmedPaidAt: timestamp("freelancer_confirmed_paid_at", { withTimezone: true, mode: 'string' }),
	companyConfirmedAt: timestamp("company_confirmed_at", { withTimezone: true, mode: 'string' }),
	freelancerConfirmedAt: timestamp("freelancer_confirmed_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("contracts_awaiting_idx").using("btree", table.updatedAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(status = 'awaiting_confirmation'::contract_status)`),
	index("contracts_company_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("enum_ops")),
	index("contracts_contact_user_idx").using("btree", table.companyContactUserId.asc().nullsLast().op("uuid_ops")),
	index("contracts_freelancer_idx").using("btree", table.freelancerId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("enum_ops")),
	index("contracts_job_idx").using("btree", table.jobId.asc().nullsLast().op("uuid_ops"), table.freelancerId.asc().nullsLast().op("uuid_ops")),
	index("contracts_terms_idx").using("btree", table.termsDocumentId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyContactUserId],
			foreignColumns: [users.id],
			name: "contracts_company_contact_user_id_fkey"
		}),
	foreignKey({
			columns: [table.termsDocumentId],
			foreignColumns: [legalDocuments.id],
			name: "contracts_terms_document_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "contracts_created_by_fkey"
		}),
	foreignKey({
			columns: [table.applicationId, table.jobId, table.freelancerId],
			foreignColumns: [applications.freelancerId, applications.id, applications.jobId],
			name: "contracts_application_id_job_id_freelancer_id_fkey"
		}),
	foreignKey({
			columns: [table.jobId, table.companyId],
			foreignColumns: [jobs.companyId, jobs.id],
			name: "contracts_job_id_company_id_fkey"
		}),
	unique("contracts_application_id_key").on(table.applicationId),
	pgPolicy("contracts_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`((freelancer_id = app.current_user_id()) OR app.is_company_member(company_id))` }),
	pgPolicy("contracts_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("contracts_app_update", { as: "permissive", for: "update", to: ["escala_app"] }),
	pgPolicy("contracts_worker_all", { as: "permissive", for: "all", to: ["escala_worker"] }),
	pgPolicy("contracts_support_all", { as: "permissive", for: "all", to: ["escala_support"] }),
	check("contracts_cancel_consistent", sql`(cancelled_by IS NULL) OR (status = ANY (ARRAY['cancelled'::contract_status, 'disputed'::contract_status]))`),
	check("contracts_no_show_consistent", sql`(no_show_party IS NULL) OR (status = ANY (ARRAY['no_show'::contract_status, 'disputed'::contract_status]))`),
]);

export const auditLogs = pgTable("audit_logs", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	actorUserId: uuid("actor_user_id"),
	targetUserId: uuid("target_user_id"),
	action: text().notNull(),
	entityType: text("entity_type"),
	entityId: uuid("entity_id"),
	ipEnc: text("ip_enc"),
	requestId: uuid("request_id"),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("audit_logs_actor_idx").using("btree", table.actorUserId.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.desc().nullsFirst().op("uuid_ops")),
	index("audit_logs_target_idx").using("btree", table.targetUserId.asc().nullsLast().op("uuid_ops"), table.occurredAt.desc().nullsFirst().op("uuid_ops")),
	index("audit_logs_time_idx").using("btree", table.occurredAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.actorUserId],
			foreignColumns: [users.id],
			name: "audit_logs_actor_user_id_fkey"
		}),
	foreignKey({
			columns: [table.targetUserId],
			foreignColumns: [users.id],
			name: "audit_logs_target_user_id_fkey"
		}),
	pgPolicy("audit_logs_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`((target_user_id = app.current_user_id()) OR (actor_user_id = app.current_user_id()))` }),
	pgPolicy("audit_logs_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("audit_logs_auth_insert", { as: "permissive", for: "insert", to: ["escala_auth"] }),
	pgPolicy("audit_logs_worker_insert", { as: "permissive", for: "insert", to: ["escala_worker"] }),
	pgPolicy("audit_logs_support_select", { as: "permissive", for: "select", to: ["escala_support"] }),
	pgPolicy("audit_logs_support_insert", { as: "permissive", for: "insert", to: ["escala_support"] }),
]);

export const featureFlags = pgTable("feature_flags", {
	key: text().primaryKey().notNull(),
	enabled: boolean().default(false).notNull(),
	rules: jsonb().default({}).notNull(),
	updatedBy: uuid("updated_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("feature_flags_updated_by_idx").using("btree", table.updatedBy.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: "feature_flags_updated_by_fkey"
		}),
	pgPolicy("feature_flags_read", { as: "permissive", for: "select", to: ["escala_app", "escala_auth", "escala_support", "escala_worker"], using: sql`true` }),
	pgPolicy("feature_flags_admin_write", { as: "permissive", for: "all", to: ["escala_support"] }),
]);

export const reputationRules = pgTable("reputation_rules", {
	id: uuid().default(sql`uuidv7()`).primaryKey().notNull(),
	code: text().notNull(),
	points: integer().default(0).notNull(),
	suspensionDays: integer("suspension_days").default(0).notNull(),
	active: boolean().default(true).notNull(),
	version: integer().default(1).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "reputation_rules_created_by_fkey"
		}),
	unique("reputation_rules_code_key").on(table.code),
	pgPolicy("reputation_rules_read", { as: "permissive", for: "select", to: ["escala_app", "escala_support", "escala_worker"], using: sql`true` }),
	pgPolicy("reputation_rules_admin_write", { as: "permissive", for: "all", to: ["escala_support"] }),
	check("reputation_rules_suspension_days_check", sql`suspension_days >= 0`),
	check("reputation_rules_version_check", sql`version >= 1`),
]);

export const favorites = pgTable("favorites", {
	companyId: uuid("company_id").notNull(),
	freelancerId: uuid("freelancer_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("favorites_freelancer_idx").using("btree", table.freelancerId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "favorites_company_id_fkey"
		}),
	foreignKey({
			columns: [table.freelancerId],
			foreignColumns: [freelancerProfiles.userId],
			name: "favorites_freelancer_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "favorites_created_by_fkey"
		}),
	primaryKey({ columns: [table.companyId, table.freelancerId], name: "favorites_pkey"}),
	pgPolicy("favorites_app_all", { as: "permissive", for: "all", to: ["escala_app"], using: sql`app.is_company_member(company_id)`, withCheck: sql`(app.is_company_member(company_id) AND app.can_view_freelancer(freelancer_id))`  }),
]);

export const userBlocks = pgTable("user_blocks", {
	blockerUserId: uuid("blocker_user_id").notNull(),
	blockedUserId: uuid("blocked_user_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("user_blocks_blocked_idx").using("btree", table.blockedUserId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.blockerUserId],
			foreignColumns: [users.id],
			name: "user_blocks_blocker_user_id_fkey"
		}),
	foreignKey({
			columns: [table.blockedUserId],
			foreignColumns: [users.id],
			name: "user_blocks_blocked_user_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "user_blocks_created_by_fkey"
		}),
	primaryKey({ columns: [table.blockedUserId, table.blockerUserId], name: "user_blocks_pkey"}),
	pgPolicy("user_blocks_app_all", { as: "permissive", for: "all", to: ["escala_app"], using: sql`(blocker_user_id = app.current_user_id())`, withCheck: sql`(blocker_user_id = app.current_user_id())`  }),
	check("user_blocks_not_self", sql`blocker_user_id <> blocked_user_id`),
]);

export const freelancerSkills = pgTable("freelancer_skills", {
	freelancerId: uuid("freelancer_id").notNull(),
	skillId: uuid("skill_id").notNull(),
	level: skillLevel().default('iniciante').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("freelancer_skills_skill_idx").using("btree", table.skillId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.skillId],
			foreignColumns: [skills.id],
			name: "freelancer_skills_skill_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "freelancer_skills_created_by_fkey"
		}),
	foreignKey({
			columns: [table.freelancerId],
			foreignColumns: [freelancerProfiles.userId],
			name: "freelancer_skills_freelancer_id_fkey"
		}),
	primaryKey({ columns: [table.freelancerId, table.skillId], name: "freelancer_skills_pkey"}),
	pgPolicy("freelancer_skills_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`app.can_view_freelancer(freelancer_id)` }),
	pgPolicy("freelancer_skills_app_write", { as: "permissive", for: "all", to: ["escala_app"] }),
	pgPolicy("freelancer_skills_support_select", { as: "permissive", for: "select", to: ["escala_support"] }),
]);

export const reviewCriteriaScores = pgTable("review_criteria_scores", {
	reviewId: uuid("review_id").notNull(),
	criterion: reviewCriterion().notNull(),
	score: smallint().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	foreignKey({
			columns: [table.reviewId],
			foreignColumns: [reviews.id],
			name: "review_criteria_scores_review_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "review_criteria_scores_created_by_fkey"
		}),
	primaryKey({ columns: [table.criterion, table.reviewId], name: "review_criteria_scores_pkey"}),
	pgPolicy("review_scores_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`app.can_read_review(review_id)` }),
	pgPolicy("review_scores_app_insert", { as: "permissive", for: "insert", to: ["escala_app"] }),
	pgPolicy("review_scores_worker_select", { as: "permissive", for: "select", to: ["escala_worker"] }),
	pgPolicy("review_scores_support_select", { as: "permissive", for: "select", to: ["escala_support"] }),
	check("review_criteria_scores_score_check", sql`(score >= 1) AND (score <= 5)`),
]);

export const idempotencyKeys = pgTable("idempotency_keys", {
	scope: text().notNull(),
	key: text().notNull(),
	userId: uuid("user_id"),
	requestSha256: text("request_sha256").notNull(),
	responseEnc: text("response_enc"),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idempotency_keys_expiry_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	index("idempotency_keys_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "idempotency_keys_user_id_fkey"
		}),
	primaryKey({ columns: [table.key, table.scope], name: "idempotency_keys_pkey"}),
	pgPolicy("idempotency_keys_app_all", { as: "permissive", for: "all", to: ["escala_app"], using: sql`(user_id = app.current_user_id())`, withCheck: sql`(user_id = app.current_user_id())`  }),
]);

export const otpCodes = pgTable("otp_codes", {
	purpose: otpPurpose().notNull(),
	subject: text().notNull(),
	codeHash: text("code_hash").notNull(),
	payloadEnc: text("payload_enc"),
	attempts: integer().default(0).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("otp_codes_expiry_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	primaryKey({ columns: [table.purpose, table.subject], name: "otp_codes_pkey"}),
	pgPolicy("otp_codes_auth_all", { as: "permissive", for: "all", to: ["escala_auth"], using: sql`true`, withCheck: sql`true`  }),
	check("otp_codes_attempts_check", sql`(attempts >= 0) AND (attempts <= 5)`),
]);

export const notificationPreferences = pgTable("notification_preferences", {
	userId: uuid("user_id").notNull(),
	type: text().notNull(),
	channel: notificationChannel().notNull(),
	enabled: boolean().default(true).notNull(),
	quietStart: time("quiet_start"),
	quietEnd: time("quiet_end"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notification_preferences_user_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "notification_preferences_created_by_fkey"
		}),
	primaryKey({ columns: [table.channel, table.type, table.userId], name: "notification_preferences_pkey"}),
	pgPolicy("notification_preferences_worker_select", { as: "permissive", for: "select", to: ["escala_worker"], using: sql`true` }),
	pgPolicy("notification_preferences_app_all", { as: "permissive", for: "all", to: ["escala_app"] }),
]);

export const conversationParticipants = pgTable("conversation_participants", {
	conversationId: uuid("conversation_id").notNull(),
	userId: uuid("user_id").notNull(),
	lastDeliveredMessageId: uuid("last_delivered_message_id"),
	lastReadMessageId: uuid("last_read_message_id"),
	mutedUntil: timestamp("muted_until", { withTimezone: true, mode: 'string' }),
	leftAt: timestamp("left_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("conversation_participants_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "conversation_participants_conversation_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "conversation_participants_user_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "conversation_participants_created_by_fkey"
		}),
	primaryKey({ columns: [table.conversationId, table.userId], name: "conversation_participants_pkey"}),
	pgPolicy("conversation_participants_app_select", { as: "permissive", for: "select", to: ["escala_app"], using: sql`app.is_conversation_participant(conversation_id)` }),
	pgPolicy("conversation_participants_app_update", { as: "permissive", for: "update", to: ["escala_app"] }),
]);
