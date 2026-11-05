// Gerado por `pnpm --filter @escala/api db:pull`. Não edite à mão.
import { relations } from "drizzle-orm/relations";
import { files, companies, users, authIdentities, mfaFactors, devices, sessions, refreshTokens, consents, legalDocuments, companyPrivateDetails, companyMembers, freelancerProfiles, availabilitySlots, kycVerifications, shifts, checkIns, jobs, jobStatusHistory, messages, messageAttachments, applications, applicationStatusHistory, contracts, contractStatusHistory, shiftStatusHistory, helpArticles, disputes, disputeStatusHistory, disputeEvidences, reviews, jobPrivateDetails, jobRequirements, skills, conversations, notifications, portfolioItems, reputationSnapshots, badges, userBadges, supportTickets, ticketStatusHistory, companyVerifications, documents, dataRequests, ticketMessages, safetyAlerts, messageReports, reviewReplies, reputationRules, penalties, penaltyAppeals, auditLogs, featureFlags, favorites, userBlocks, freelancerSkills, reviewCriteriaScores, idempotencyKeys, notificationPreferences, conversationParticipants } from "./schema.js";

export const companiesRelations = relations(companies, ({one, many}) => ({
	file: one(files, {
		fields: [companies.logoFileId],
		references: [files.id]
	}),
	user: one(users, {
		fields: [companies.createdBy],
		references: [users.id]
	}),
	companyPrivateDetails: many(companyPrivateDetails),
	companyMembers: many(companyMembers),
	reviews: many(reviews),
	reputationSnapshots: many(reputationSnapshots),
	userBadges: many(userBadges),
	companyVerifications: many(companyVerifications),
	jobs: many(jobs),
	penalties: many(penalties),
	favorites: many(favorites),
}));

export const filesRelations = relations(files, ({one, many}) => ({
	companies: many(companies),
	messageAttachments: many(messageAttachments),
	disputeEvidences: many(disputeEvidences),
	user_ownerUserId: one(users, {
		fields: [files.ownerUserId],
		references: [users.id],
		relationName: "files_ownerUserId_users_id"
	}),
	user_createdBy: one(users, {
		fields: [files.createdBy],
		references: [users.id],
		relationName: "files_createdBy_users_id"
	}),
	freelancerProfiles: many(freelancerProfiles),
	portfolioItems: many(portfolioItems),
	documents: many(documents),
	dataRequests: many(dataRequests),
	ticketMessages: many(ticketMessages),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	companies: many(companies),
	user: one(users, {
		fields: [users.createdBy],
		references: [users.id],
		relationName: "users_createdBy_users_id"
	}),
	users: many(users, {
		relationName: "users_createdBy_users_id"
	}),
	authIdentities_userId: many(authIdentities, {
		relationName: "authIdentities_userId_users_id"
	}),
	authIdentities_createdBy: many(authIdentities, {
		relationName: "authIdentities_createdBy_users_id"
	}),
	mfaFactors_userId: many(mfaFactors, {
		relationName: "mfaFactors_userId_users_id"
	}),
	mfaFactors_createdBy: many(mfaFactors, {
		relationName: "mfaFactors_createdBy_users_id"
	}),
	sessions_createdBy: many(sessions, {
		relationName: "sessions_createdBy_users_id"
	}),
	sessions_userId: many(sessions, {
		relationName: "sessions_userId_users_id"
	}),
	refreshTokens: many(refreshTokens),
	devices_userId: many(devices, {
		relationName: "devices_userId_users_id"
	}),
	devices_createdBy: many(devices, {
		relationName: "devices_createdBy_users_id"
	}),
	consents_userId: many(consents, {
		relationName: "consents_userId_users_id"
	}),
	consents_createdBy: many(consents, {
		relationName: "consents_createdBy_users_id"
	}),
	companyPrivateDetails: many(companyPrivateDetails),
	companyMembers_userId: many(companyMembers, {
		relationName: "companyMembers_userId_users_id"
	}),
	companyMembers_invitedBy: many(companyMembers, {
		relationName: "companyMembers_invitedBy_users_id"
	}),
	companyMembers_createdBy: many(companyMembers, {
		relationName: "companyMembers_createdBy_users_id"
	}),
	availabilitySlots: many(availabilitySlots),
	kycVerifications_userId: many(kycVerifications, {
		relationName: "kycVerifications_userId_users_id"
	}),
	kycVerifications_createdBy: many(kycVerifications, {
		relationName: "kycVerifications_createdBy_users_id"
	}),
	checkIns: many(checkIns),
	jobStatusHistories: many(jobStatusHistory),
	messageAttachments: many(messageAttachments),
	applicationStatusHistories: many(applicationStatusHistory),
	contractStatusHistories: many(contractStatusHistory),
	shiftStatusHistories: many(shiftStatusHistory),
	helpArticles: many(helpArticles),
	disputeStatusHistories: many(disputeStatusHistory),
	disputeEvidences_submittedBy: many(disputeEvidences, {
		relationName: "disputeEvidences_submittedBy_users_id"
	}),
	disputeEvidences_createdBy: many(disputeEvidences, {
		relationName: "disputeEvidences_createdBy_users_id"
	}),
	reviews_reviewerUserId: many(reviews, {
		relationName: "reviews_reviewerUserId_users_id"
	}),
	reviews_subjectUserId: many(reviews, {
		relationName: "reviews_subjectUserId_users_id"
	}),
	reviews_createdBy: many(reviews, {
		relationName: "reviews_createdBy_users_id"
	}),
	jobPrivateDetails: many(jobPrivateDetails),
	jobRequirements: many(jobRequirements),
	conversations: many(conversations),
	messages_senderUserId: many(messages, {
		relationName: "messages_senderUserId_users_id"
	}),
	messages_createdBy: many(messages, {
		relationName: "messages_createdBy_users_id"
	}),
	notifications_userId: many(notifications, {
		relationName: "notifications_userId_users_id"
	}),
	notifications_createdBy: many(notifications, {
		relationName: "notifications_createdBy_users_id"
	}),
	files_ownerUserId: many(files, {
		relationName: "files_ownerUserId_users_id"
	}),
	files_createdBy: many(files, {
		relationName: "files_createdBy_users_id"
	}),
	freelancerProfiles_userId: many(freelancerProfiles, {
		relationName: "freelancerProfiles_userId_users_id"
	}),
	freelancerProfiles_createdBy: many(freelancerProfiles, {
		relationName: "freelancerProfiles_createdBy_users_id"
	}),
	portfolioItems: many(portfolioItems),
	applications: many(applications),
	shifts: many(shifts),
	reputationSnapshots_subjectUserId: many(reputationSnapshots, {
		relationName: "reputationSnapshots_subjectUserId_users_id"
	}),
	reputationSnapshots_createdBy: many(reputationSnapshots, {
		relationName: "reputationSnapshots_createdBy_users_id"
	}),
	userBadges_subjectUserId: many(userBadges, {
		relationName: "userBadges_subjectUserId_users_id"
	}),
	userBadges_createdBy: many(userBadges, {
		relationName: "userBadges_createdBy_users_id"
	}),
	ticketStatusHistories: many(ticketStatusHistory),
	legalDocuments: many(legalDocuments),
	companyVerifications: many(companyVerifications),
	jobs: many(jobs),
	documents_userId: many(documents, {
		relationName: "documents_userId_users_id"
	}),
	documents_createdBy: many(documents, {
		relationName: "documents_createdBy_users_id"
	}),
	dataRequests_userId: many(dataRequests, {
		relationName: "dataRequests_userId_users_id"
	}),
	dataRequests_createdBy: many(dataRequests, {
		relationName: "dataRequests_createdBy_users_id"
	}),
	skills: many(skills),
	badges: many(badges),
	supportTickets_requesterUserId: many(supportTickets, {
		relationName: "supportTickets_requesterUserId_users_id"
	}),
	supportTickets_assigneeUserId: many(supportTickets, {
		relationName: "supportTickets_assigneeUserId_users_id"
	}),
	supportTickets_createdBy: many(supportTickets, {
		relationName: "supportTickets_createdBy_users_id"
	}),
	ticketMessages_authorUserId: many(ticketMessages, {
		relationName: "ticketMessages_authorUserId_users_id"
	}),
	ticketMessages_createdBy: many(ticketMessages, {
		relationName: "ticketMessages_createdBy_users_id"
	}),
	disputes_openedBy: many(disputes, {
		relationName: "disputes_openedBy_users_id"
	}),
	disputes_decidedBy: many(disputes, {
		relationName: "disputes_decidedBy_users_id"
	}),
	disputes_createdBy: many(disputes, {
		relationName: "disputes_createdBy_users_id"
	}),
	safetyAlerts_userId: many(safetyAlerts, {
		relationName: "safetyAlerts_userId_users_id"
	}),
	safetyAlerts_handledBy: many(safetyAlerts, {
		relationName: "safetyAlerts_handledBy_users_id"
	}),
	safetyAlerts_createdBy: many(safetyAlerts, {
		relationName: "safetyAlerts_createdBy_users_id"
	}),
	messageReports_reporterUserId: many(messageReports, {
		relationName: "messageReports_reporterUserId_users_id"
	}),
	messageReports_resolvedBy: many(messageReports, {
		relationName: "messageReports_resolvedBy_users_id"
	}),
	messageReports_createdBy: many(messageReports, {
		relationName: "messageReports_createdBy_users_id"
	}),
	reviewReplies_authorUserId: many(reviewReplies, {
		relationName: "reviewReplies_authorUserId_users_id"
	}),
	reviewReplies_createdBy: many(reviewReplies, {
		relationName: "reviewReplies_createdBy_users_id"
	}),
	penalties_subjectUserId: many(penalties, {
		relationName: "penalties_subjectUserId_users_id"
	}),
	penalties_createdBy: many(penalties, {
		relationName: "penalties_createdBy_users_id"
	}),
	penaltyAppeals_submittedBy: many(penaltyAppeals, {
		relationName: "penaltyAppeals_submittedBy_users_id"
	}),
	penaltyAppeals_decidedBy: many(penaltyAppeals, {
		relationName: "penaltyAppeals_decidedBy_users_id"
	}),
	penaltyAppeals_createdBy: many(penaltyAppeals, {
		relationName: "penaltyAppeals_createdBy_users_id"
	}),
	contracts_companyContactUserId: many(contracts, {
		relationName: "contracts_companyContactUserId_users_id"
	}),
	contracts_createdBy: many(contracts, {
		relationName: "contracts_createdBy_users_id"
	}),
	auditLogs_actorUserId: many(auditLogs, {
		relationName: "auditLogs_actorUserId_users_id"
	}),
	auditLogs_targetUserId: many(auditLogs, {
		relationName: "auditLogs_targetUserId_users_id"
	}),
	featureFlags: many(featureFlags),
	reputationRules: many(reputationRules),
	favorites: many(favorites),
	userBlocks_blockerUserId: many(userBlocks, {
		relationName: "userBlocks_blockerUserId_users_id"
	}),
	userBlocks_blockedUserId: many(userBlocks, {
		relationName: "userBlocks_blockedUserId_users_id"
	}),
	userBlocks_createdBy: many(userBlocks, {
		relationName: "userBlocks_createdBy_users_id"
	}),
	freelancerSkills: many(freelancerSkills),
	reviewCriteriaScores: many(reviewCriteriaScores),
	idempotencyKeys: many(idempotencyKeys),
	notificationPreferences_userId: many(notificationPreferences, {
		relationName: "notificationPreferences_userId_users_id"
	}),
	notificationPreferences_createdBy: many(notificationPreferences, {
		relationName: "notificationPreferences_createdBy_users_id"
	}),
	conversationParticipants_userId: many(conversationParticipants, {
		relationName: "conversationParticipants_userId_users_id"
	}),
	conversationParticipants_createdBy: many(conversationParticipants, {
		relationName: "conversationParticipants_createdBy_users_id"
	}),
}));

export const authIdentitiesRelations = relations(authIdentities, ({one}) => ({
	user_userId: one(users, {
		fields: [authIdentities.userId],
		references: [users.id],
		relationName: "authIdentities_userId_users_id"
	}),
	user_createdBy: one(users, {
		fields: [authIdentities.createdBy],
		references: [users.id],
		relationName: "authIdentities_createdBy_users_id"
	}),
}));

export const mfaFactorsRelations = relations(mfaFactors, ({one}) => ({
	user_userId: one(users, {
		fields: [mfaFactors.userId],
		references: [users.id],
		relationName: "mfaFactors_userId_users_id"
	}),
	user_createdBy: one(users, {
		fields: [mfaFactors.createdBy],
		references: [users.id],
		relationName: "mfaFactors_createdBy_users_id"
	}),
}));

export const sessionsRelations = relations(sessions, ({one, many}) => ({
	device: one(devices, {
		fields: [sessions.deviceId],
		references: [devices.id]
	}),
	user_createdBy: one(users, {
		fields: [sessions.createdBy],
		references: [users.id],
		relationName: "sessions_createdBy_users_id"
	}),
	user_userId: one(users, {
		fields: [sessions.userId],
		references: [users.id],
		relationName: "sessions_userId_users_id"
	}),
	refreshTokens: many(refreshTokens),
}));

export const devicesRelations = relations(devices, ({one, many}) => ({
	sessions: many(sessions),
	user_userId: one(users, {
		fields: [devices.userId],
		references: [users.id],
		relationName: "devices_userId_users_id"
	}),
	user_createdBy: one(users, {
		fields: [devices.createdBy],
		references: [users.id],
		relationName: "devices_createdBy_users_id"
	}),
}));

export const refreshTokensRelations = relations(refreshTokens, ({one}) => ({
	session: one(sessions, {
		fields: [refreshTokens.sessionId],
		references: [sessions.id]
	}),
	user: one(users, {
		fields: [refreshTokens.createdBy],
		references: [users.id]
	}),
}));

export const consentsRelations = relations(consents, ({one}) => ({
	user_userId: one(users, {
		fields: [consents.userId],
		references: [users.id],
		relationName: "consents_userId_users_id"
	}),
	legalDocument: one(legalDocuments, {
		fields: [consents.documentId],
		references: [legalDocuments.id]
	}),
	user_createdBy: one(users, {
		fields: [consents.createdBy],
		references: [users.id],
		relationName: "consents_createdBy_users_id"
	}),
}));

export const legalDocumentsRelations = relations(legalDocuments, ({one, many}) => ({
	consents: many(consents),
	user: one(users, {
		fields: [legalDocuments.createdBy],
		references: [users.id]
	}),
	contracts: many(contracts),
}));

export const companyPrivateDetailsRelations = relations(companyPrivateDetails, ({one}) => ({
	company: one(companies, {
		fields: [companyPrivateDetails.companyId],
		references: [companies.id]
	}),
	user: one(users, {
		fields: [companyPrivateDetails.createdBy],
		references: [users.id]
	}),
}));

export const companyMembersRelations = relations(companyMembers, ({one}) => ({
	company: one(companies, {
		fields: [companyMembers.companyId],
		references: [companies.id]
	}),
	user_userId: one(users, {
		fields: [companyMembers.userId],
		references: [users.id],
		relationName: "companyMembers_userId_users_id"
	}),
	user_invitedBy: one(users, {
		fields: [companyMembers.invitedBy],
		references: [users.id],
		relationName: "companyMembers_invitedBy_users_id"
	}),
	user_createdBy: one(users, {
		fields: [companyMembers.createdBy],
		references: [users.id],
		relationName: "companyMembers_createdBy_users_id"
	}),
}));

export const availabilitySlotsRelations = relations(availabilitySlots, ({one}) => ({
	freelancerProfile: one(freelancerProfiles, {
		fields: [availabilitySlots.freelancerId],
		references: [freelancerProfiles.userId]
	}),
	user: one(users, {
		fields: [availabilitySlots.createdBy],
		references: [users.id]
	}),
}));

export const freelancerProfilesRelations = relations(freelancerProfiles, ({one, many}) => ({
	availabilitySlots: many(availabilitySlots),
	user_userId: one(users, {
		fields: [freelancerProfiles.userId],
		references: [users.id],
		relationName: "freelancerProfiles_userId_users_id"
	}),
	file: one(files, {
		fields: [freelancerProfiles.photoFileId],
		references: [files.id]
	}),
	user_createdBy: one(users, {
		fields: [freelancerProfiles.createdBy],
		references: [users.id],
		relationName: "freelancerProfiles_createdBy_users_id"
	}),
	portfolioItems: many(portfolioItems),
	applications: many(applications),
	favorites: many(favorites),
	freelancerSkills: many(freelancerSkills),
}));

export const kycVerificationsRelations = relations(kycVerifications, ({one}) => ({
	user_userId: one(users, {
		fields: [kycVerifications.userId],
		references: [users.id],
		relationName: "kycVerifications_userId_users_id"
	}),
	user_createdBy: one(users, {
		fields: [kycVerifications.createdBy],
		references: [users.id],
		relationName: "kycVerifications_createdBy_users_id"
	}),
}));

export const checkInsRelations = relations(checkIns, ({one}) => ({
	shift: one(shifts, {
		fields: [checkIns.shiftId],
		references: [shifts.id]
	}),
	user: one(users, {
		fields: [checkIns.createdBy],
		references: [users.id]
	}),
}));

export const shiftsRelations = relations(shifts, ({one, many}) => ({
	checkIns: many(checkIns),
	shiftStatusHistories: many(shiftStatusHistory),
	contract: one(contracts, {
		fields: [shifts.contractId],
		references: [contracts.id]
	}),
	user: one(users, {
		fields: [shifts.createdBy],
		references: [users.id]
	}),
	safetyAlerts: many(safetyAlerts),
}));

export const jobStatusHistoryRelations = relations(jobStatusHistory, ({one}) => ({
	job: one(jobs, {
		fields: [jobStatusHistory.jobId],
		references: [jobs.id]
	}),
	user: one(users, {
		fields: [jobStatusHistory.actorUserId],
		references: [users.id]
	}),
}));

export const jobsRelations = relations(jobs, ({one, many}) => ({
	jobStatusHistories: many(jobStatusHistory),
	jobPrivateDetails: many(jobPrivateDetails),
	jobRequirements: many(jobRequirements),
	applications: many(applications),
	company: one(companies, {
		fields: [jobs.companyId],
		references: [companies.id]
	}),
	skill: one(skills, {
		fields: [jobs.primarySkillId],
		references: [skills.id]
	}),
	user: one(users, {
		fields: [jobs.createdBy],
		references: [users.id]
	}),
	contracts: many(contracts),
}));

export const messageAttachmentsRelations = relations(messageAttachments, ({one}) => ({
	message: one(messages, {
		fields: [messageAttachments.messageId],
		references: [messages.id]
	}),
	file: one(files, {
		fields: [messageAttachments.fileId],
		references: [files.id]
	}),
	user: one(users, {
		fields: [messageAttachments.createdBy],
		references: [users.id]
	}),
}));

export const messagesRelations = relations(messages, ({one, many}) => ({
	messageAttachments: many(messageAttachments),
	conversation: one(conversations, {
		fields: [messages.conversationId],
		references: [conversations.id]
	}),
	user_senderUserId: one(users, {
		fields: [messages.senderUserId],
		references: [users.id],
		relationName: "messages_senderUserId_users_id"
	}),
	user_createdBy: one(users, {
		fields: [messages.createdBy],
		references: [users.id],
		relationName: "messages_createdBy_users_id"
	}),
	messageReports: many(messageReports),
}));

export const applicationStatusHistoryRelations = relations(applicationStatusHistory, ({one}) => ({
	application: one(applications, {
		fields: [applicationStatusHistory.applicationId],
		references: [applications.id]
	}),
	user: one(users, {
		fields: [applicationStatusHistory.actorUserId],
		references: [users.id]
	}),
}));

export const applicationsRelations = relations(applications, ({one, many}) => ({
	applicationStatusHistories: many(applicationStatusHistory),
	conversations: many(conversations),
	job: one(jobs, {
		fields: [applications.jobId],
		references: [jobs.id]
	}),
	freelancerProfile: one(freelancerProfiles, {
		fields: [applications.freelancerId],
		references: [freelancerProfiles.userId]
	}),
	user: one(users, {
		fields: [applications.createdBy],
		references: [users.id]
	}),
	contracts: many(contracts),
}));

export const contractStatusHistoryRelations = relations(contractStatusHistory, ({one}) => ({
	contract: one(contracts, {
		fields: [contractStatusHistory.contractId],
		references: [contracts.id]
	}),
	user: one(users, {
		fields: [contractStatusHistory.actorUserId],
		references: [users.id]
	}),
}));

export const contractsRelations = relations(contracts, ({one, many}) => ({
	contractStatusHistories: many(contractStatusHistory),
	reviews: many(reviews),
	shifts: many(shifts),
	supportTickets: many(supportTickets),
	disputes: many(disputes),
	penalties: many(penalties),
	user_companyContactUserId: one(users, {
		fields: [contracts.companyContactUserId],
		references: [users.id],
		relationName: "contracts_companyContactUserId_users_id"
	}),
	legalDocument: one(legalDocuments, {
		fields: [contracts.termsDocumentId],
		references: [legalDocuments.id]
	}),
	user_createdBy: one(users, {
		fields: [contracts.createdBy],
		references: [users.id],
		relationName: "contracts_createdBy_users_id"
	}),
	application: one(applications, {
		fields: [contracts.applicationId],
		references: [applications.freelancerId]
	}),
	job: one(jobs, {
		fields: [contracts.jobId],
		references: [jobs.companyId]
	}),
}));

export const shiftStatusHistoryRelations = relations(shiftStatusHistory, ({one}) => ({
	shift: one(shifts, {
		fields: [shiftStatusHistory.shiftId],
		references: [shifts.id]
	}),
	user: one(users, {
		fields: [shiftStatusHistory.actorUserId],
		references: [users.id]
	}),
}));

export const helpArticlesRelations = relations(helpArticles, ({one}) => ({
	user: one(users, {
		fields: [helpArticles.createdBy],
		references: [users.id]
	}),
}));

export const disputeStatusHistoryRelations = relations(disputeStatusHistory, ({one}) => ({
	dispute: one(disputes, {
		fields: [disputeStatusHistory.disputeId],
		references: [disputes.id]
	}),
	user: one(users, {
		fields: [disputeStatusHistory.actorUserId],
		references: [users.id]
	}),
}));

export const disputesRelations = relations(disputes, ({one, many}) => ({
	disputeStatusHistories: many(disputeStatusHistory),
	disputeEvidences: many(disputeEvidences),
	contract: one(contracts, {
		fields: [disputes.contractId],
		references: [contracts.id]
	}),
	supportTicket: one(supportTickets, {
		fields: [disputes.ticketId],
		references: [supportTickets.id]
	}),
	user_openedBy: one(users, {
		fields: [disputes.openedBy],
		references: [users.id],
		relationName: "disputes_openedBy_users_id"
	}),
	user_decidedBy: one(users, {
		fields: [disputes.decidedBy],
		references: [users.id],
		relationName: "disputes_decidedBy_users_id"
	}),
	user_createdBy: one(users, {
		fields: [disputes.createdBy],
		references: [users.id],
		relationName: "disputes_createdBy_users_id"
	}),
}));

export const disputeEvidencesRelations = relations(disputeEvidences, ({one}) => ({
	dispute: one(disputes, {
		fields: [disputeEvidences.disputeId],
		references: [disputes.id]
	}),
	user_submittedBy: one(users, {
		fields: [disputeEvidences.submittedBy],
		references: [users.id],
		relationName: "disputeEvidences_submittedBy_users_id"
	}),
	file: one(files, {
		fields: [disputeEvidences.fileId],
		references: [files.id]
	}),
	user_createdBy: one(users, {
		fields: [disputeEvidences.createdBy],
		references: [users.id],
		relationName: "disputeEvidences_createdBy_users_id"
	}),
}));

export const reviewsRelations = relations(reviews, ({one, many}) => ({
	contract: one(contracts, {
		fields: [reviews.contractId],
		references: [contracts.id]
	}),
	user_reviewerUserId: one(users, {
		fields: [reviews.reviewerUserId],
		references: [users.id],
		relationName: "reviews_reviewerUserId_users_id"
	}),
	user_subjectUserId: one(users, {
		fields: [reviews.subjectUserId],
		references: [users.id],
		relationName: "reviews_subjectUserId_users_id"
	}),
	company: one(companies, {
		fields: [reviews.subjectCompanyId],
		references: [companies.id]
	}),
	user_createdBy: one(users, {
		fields: [reviews.createdBy],
		references: [users.id],
		relationName: "reviews_createdBy_users_id"
	}),
	reviewReplies: many(reviewReplies),
	reviewCriteriaScores: many(reviewCriteriaScores),
}));

export const jobPrivateDetailsRelations = relations(jobPrivateDetails, ({one}) => ({
	job: one(jobs, {
		fields: [jobPrivateDetails.jobId],
		references: [jobs.id]
	}),
	user: one(users, {
		fields: [jobPrivateDetails.createdBy],
		references: [users.id]
	}),
}));

export const jobRequirementsRelations = relations(jobRequirements, ({one}) => ({
	job: one(jobs, {
		fields: [jobRequirements.jobId],
		references: [jobs.id]
	}),
	skill: one(skills, {
		fields: [jobRequirements.skillId],
		references: [skills.id]
	}),
	user: one(users, {
		fields: [jobRequirements.createdBy],
		references: [users.id]
	}),
}));

export const skillsRelations = relations(skills, ({one, many}) => ({
	jobRequirements: many(jobRequirements),
	jobs: many(jobs),
	user: one(users, {
		fields: [skills.createdBy],
		references: [users.id]
	}),
	freelancerSkills: many(freelancerSkills),
}));

export const conversationsRelations = relations(conversations, ({one, many}) => ({
	application: one(applications, {
		fields: [conversations.applicationId],
		references: [applications.id]
	}),
	user: one(users, {
		fields: [conversations.createdBy],
		references: [users.id]
	}),
	messages: many(messages),
	conversationParticipants: many(conversationParticipants),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	user_userId: one(users, {
		fields: [notifications.userId],
		references: [users.id],
		relationName: "notifications_userId_users_id"
	}),
	user_createdBy: one(users, {
		fields: [notifications.createdBy],
		references: [users.id],
		relationName: "notifications_createdBy_users_id"
	}),
}));

export const portfolioItemsRelations = relations(portfolioItems, ({one}) => ({
	freelancerProfile: one(freelancerProfiles, {
		fields: [portfolioItems.freelancerId],
		references: [freelancerProfiles.userId]
	}),
	file: one(files, {
		fields: [portfolioItems.fileId],
		references: [files.id]
	}),
	user: one(users, {
		fields: [portfolioItems.createdBy],
		references: [users.id]
	}),
}));

export const reputationSnapshotsRelations = relations(reputationSnapshots, ({one}) => ({
	user_subjectUserId: one(users, {
		fields: [reputationSnapshots.subjectUserId],
		references: [users.id],
		relationName: "reputationSnapshots_subjectUserId_users_id"
	}),
	company: one(companies, {
		fields: [reputationSnapshots.subjectCompanyId],
		references: [companies.id]
	}),
	user_createdBy: one(users, {
		fields: [reputationSnapshots.createdBy],
		references: [users.id],
		relationName: "reputationSnapshots_createdBy_users_id"
	}),
}));

export const userBadgesRelations = relations(userBadges, ({one}) => ({
	badge: one(badges, {
		fields: [userBadges.badgeId],
		references: [badges.id]
	}),
	user_subjectUserId: one(users, {
		fields: [userBadges.subjectUserId],
		references: [users.id],
		relationName: "userBadges_subjectUserId_users_id"
	}),
	company: one(companies, {
		fields: [userBadges.subjectCompanyId],
		references: [companies.id]
	}),
	user_createdBy: one(users, {
		fields: [userBadges.createdBy],
		references: [users.id],
		relationName: "userBadges_createdBy_users_id"
	}),
}));

export const badgesRelations = relations(badges, ({one, many}) => ({
	userBadges: many(userBadges),
	user: one(users, {
		fields: [badges.createdBy],
		references: [users.id]
	}),
}));

export const ticketStatusHistoryRelations = relations(ticketStatusHistory, ({one}) => ({
	supportTicket: one(supportTickets, {
		fields: [ticketStatusHistory.ticketId],
		references: [supportTickets.id]
	}),
	user: one(users, {
		fields: [ticketStatusHistory.actorUserId],
		references: [users.id]
	}),
}));

export const supportTicketsRelations = relations(supportTickets, ({one, many}) => ({
	ticketStatusHistories: many(ticketStatusHistory),
	user_requesterUserId: one(users, {
		fields: [supportTickets.requesterUserId],
		references: [users.id],
		relationName: "supportTickets_requesterUserId_users_id"
	}),
	contract: one(contracts, {
		fields: [supportTickets.contractId],
		references: [contracts.id]
	}),
	user_assigneeUserId: one(users, {
		fields: [supportTickets.assigneeUserId],
		references: [users.id],
		relationName: "supportTickets_assigneeUserId_users_id"
	}),
	user_createdBy: one(users, {
		fields: [supportTickets.createdBy],
		references: [users.id],
		relationName: "supportTickets_createdBy_users_id"
	}),
	ticketMessages: many(ticketMessages),
	disputes: many(disputes),
}));

export const companyVerificationsRelations = relations(companyVerifications, ({one}) => ({
	company: one(companies, {
		fields: [companyVerifications.companyId],
		references: [companies.id]
	}),
	user: one(users, {
		fields: [companyVerifications.createdBy],
		references: [users.id]
	}),
}));

export const documentsRelations = relations(documents, ({one}) => ({
	user_userId: one(users, {
		fields: [documents.userId],
		references: [users.id],
		relationName: "documents_userId_users_id"
	}),
	file: one(files, {
		fields: [documents.fileId],
		references: [files.id]
	}),
	user_createdBy: one(users, {
		fields: [documents.createdBy],
		references: [users.id],
		relationName: "documents_createdBy_users_id"
	}),
}));

export const dataRequestsRelations = relations(dataRequests, ({one}) => ({
	user_userId: one(users, {
		fields: [dataRequests.userId],
		references: [users.id],
		relationName: "dataRequests_userId_users_id"
	}),
	file: one(files, {
		fields: [dataRequests.fileId],
		references: [files.id]
	}),
	user_createdBy: one(users, {
		fields: [dataRequests.createdBy],
		references: [users.id],
		relationName: "dataRequests_createdBy_users_id"
	}),
}));

export const ticketMessagesRelations = relations(ticketMessages, ({one}) => ({
	supportTicket: one(supportTickets, {
		fields: [ticketMessages.ticketId],
		references: [supportTickets.id]
	}),
	user_authorUserId: one(users, {
		fields: [ticketMessages.authorUserId],
		references: [users.id],
		relationName: "ticketMessages_authorUserId_users_id"
	}),
	file: one(files, {
		fields: [ticketMessages.fileId],
		references: [files.id]
	}),
	user_createdBy: one(users, {
		fields: [ticketMessages.createdBy],
		references: [users.id],
		relationName: "ticketMessages_createdBy_users_id"
	}),
}));

export const safetyAlertsRelations = relations(safetyAlerts, ({one}) => ({
	user_userId: one(users, {
		fields: [safetyAlerts.userId],
		references: [users.id],
		relationName: "safetyAlerts_userId_users_id"
	}),
	shift: one(shifts, {
		fields: [safetyAlerts.shiftId],
		references: [shifts.id]
	}),
	user_handledBy: one(users, {
		fields: [safetyAlerts.handledBy],
		references: [users.id],
		relationName: "safetyAlerts_handledBy_users_id"
	}),
	user_createdBy: one(users, {
		fields: [safetyAlerts.createdBy],
		references: [users.id],
		relationName: "safetyAlerts_createdBy_users_id"
	}),
}));

export const messageReportsRelations = relations(messageReports, ({one}) => ({
	message: one(messages, {
		fields: [messageReports.messageId],
		references: [messages.id]
	}),
	user_reporterUserId: one(users, {
		fields: [messageReports.reporterUserId],
		references: [users.id],
		relationName: "messageReports_reporterUserId_users_id"
	}),
	user_resolvedBy: one(users, {
		fields: [messageReports.resolvedBy],
		references: [users.id],
		relationName: "messageReports_resolvedBy_users_id"
	}),
	user_createdBy: one(users, {
		fields: [messageReports.createdBy],
		references: [users.id],
		relationName: "messageReports_createdBy_users_id"
	}),
}));

export const reviewRepliesRelations = relations(reviewReplies, ({one}) => ({
	review: one(reviews, {
		fields: [reviewReplies.reviewId],
		references: [reviews.id]
	}),
	user_authorUserId: one(users, {
		fields: [reviewReplies.authorUserId],
		references: [users.id],
		relationName: "reviewReplies_authorUserId_users_id"
	}),
	user_createdBy: one(users, {
		fields: [reviewReplies.createdBy],
		references: [users.id],
		relationName: "reviewReplies_createdBy_users_id"
	}),
}));

export const penaltiesRelations = relations(penalties, ({one, many}) => ({
	reputationRule: one(reputationRules, {
		fields: [penalties.ruleId],
		references: [reputationRules.id]
	}),
	user_subjectUserId: one(users, {
		fields: [penalties.subjectUserId],
		references: [users.id],
		relationName: "penalties_subjectUserId_users_id"
	}),
	company: one(companies, {
		fields: [penalties.subjectCompanyId],
		references: [companies.id]
	}),
	contract: one(contracts, {
		fields: [penalties.contractId],
		references: [contracts.id]
	}),
	user_createdBy: one(users, {
		fields: [penalties.createdBy],
		references: [users.id],
		relationName: "penalties_createdBy_users_id"
	}),
	penaltyAppeals: many(penaltyAppeals),
}));

export const reputationRulesRelations = relations(reputationRules, ({one, many}) => ({
	penalties: many(penalties),
	user: one(users, {
		fields: [reputationRules.createdBy],
		references: [users.id]
	}),
}));

export const penaltyAppealsRelations = relations(penaltyAppeals, ({one}) => ({
	penalty: one(penalties, {
		fields: [penaltyAppeals.penaltyId],
		references: [penalties.id]
	}),
	user_submittedBy: one(users, {
		fields: [penaltyAppeals.submittedBy],
		references: [users.id],
		relationName: "penaltyAppeals_submittedBy_users_id"
	}),
	user_decidedBy: one(users, {
		fields: [penaltyAppeals.decidedBy],
		references: [users.id],
		relationName: "penaltyAppeals_decidedBy_users_id"
	}),
	user_createdBy: one(users, {
		fields: [penaltyAppeals.createdBy],
		references: [users.id],
		relationName: "penaltyAppeals_createdBy_users_id"
	}),
}));

export const auditLogsRelations = relations(auditLogs, ({one}) => ({
	user_actorUserId: one(users, {
		fields: [auditLogs.actorUserId],
		references: [users.id],
		relationName: "auditLogs_actorUserId_users_id"
	}),
	user_targetUserId: one(users, {
		fields: [auditLogs.targetUserId],
		references: [users.id],
		relationName: "auditLogs_targetUserId_users_id"
	}),
}));

export const featureFlagsRelations = relations(featureFlags, ({one}) => ({
	user: one(users, {
		fields: [featureFlags.updatedBy],
		references: [users.id]
	}),
}));

export const favoritesRelations = relations(favorites, ({one}) => ({
	company: one(companies, {
		fields: [favorites.companyId],
		references: [companies.id]
	}),
	freelancerProfile: one(freelancerProfiles, {
		fields: [favorites.freelancerId],
		references: [freelancerProfiles.userId]
	}),
	user: one(users, {
		fields: [favorites.createdBy],
		references: [users.id]
	}),
}));

export const userBlocksRelations = relations(userBlocks, ({one}) => ({
	user_blockerUserId: one(users, {
		fields: [userBlocks.blockerUserId],
		references: [users.id],
		relationName: "userBlocks_blockerUserId_users_id"
	}),
	user_blockedUserId: one(users, {
		fields: [userBlocks.blockedUserId],
		references: [users.id],
		relationName: "userBlocks_blockedUserId_users_id"
	}),
	user_createdBy: one(users, {
		fields: [userBlocks.createdBy],
		references: [users.id],
		relationName: "userBlocks_createdBy_users_id"
	}),
}));

export const freelancerSkillsRelations = relations(freelancerSkills, ({one}) => ({
	skill: one(skills, {
		fields: [freelancerSkills.skillId],
		references: [skills.id]
	}),
	user: one(users, {
		fields: [freelancerSkills.createdBy],
		references: [users.id]
	}),
	freelancerProfile: one(freelancerProfiles, {
		fields: [freelancerSkills.freelancerId],
		references: [freelancerProfiles.userId]
	}),
}));

export const reviewCriteriaScoresRelations = relations(reviewCriteriaScores, ({one}) => ({
	review: one(reviews, {
		fields: [reviewCriteriaScores.reviewId],
		references: [reviews.id]
	}),
	user: one(users, {
		fields: [reviewCriteriaScores.createdBy],
		references: [users.id]
	}),
}));

export const idempotencyKeysRelations = relations(idempotencyKeys, ({one}) => ({
	user: one(users, {
		fields: [idempotencyKeys.userId],
		references: [users.id]
	}),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({one}) => ({
	user_userId: one(users, {
		fields: [notificationPreferences.userId],
		references: [users.id],
		relationName: "notificationPreferences_userId_users_id"
	}),
	user_createdBy: one(users, {
		fields: [notificationPreferences.createdBy],
		references: [users.id],
		relationName: "notificationPreferences_createdBy_users_id"
	}),
}));

export const conversationParticipantsRelations = relations(conversationParticipants, ({one}) => ({
	conversation: one(conversations, {
		fields: [conversationParticipants.conversationId],
		references: [conversations.id]
	}),
	user_userId: one(users, {
		fields: [conversationParticipants.userId],
		references: [users.id],
		relationName: "conversationParticipants_userId_users_id"
	}),
	user_createdBy: one(users, {
		fields: [conversationParticipants.createdBy],
		references: [users.id],
		relationName: "conversationParticipants_createdBy_users_id"
	}),
}));