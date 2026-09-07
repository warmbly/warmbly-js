/** Public barrel for the REST resource pillar: resource classes plus their types. */

export type {
  AdvisorAction,
  AdvisorCategory,
  AdvisorFinding,
  AdvisorPreviewChange,
  AdvisorSeverity,
  AdvisorStatus,
  AdvisorSummary,
  AdvisorSurface,
  AdvisorSurfaceCount,
  ListAdvisorParams,
} from "./advisor";
export { Advisor } from "./advisor";
export type {
  AgentTool,
  AgentToolResult,
  JsonSchema,
  OpenAIFunctionTool,
} from "./agent-tools";
export { AgentTools } from "./agent-tools";
export type {
  AISkill,
  CreateAISkillParams,
  UpdateAISkillParams,
} from "./ai-skills";
export { AISkills } from "./ai-skills";
export type { AnalyticsParams, AnalyticsReport } from "./analytics";
export { Analytics } from "./analytics";
export type {
  ApiKey,
  ApiKeyAnalytics,
  ApiKeyAnalyticsParams,
  ApiKeyLog,
  ApiKeyLogsParams,
  ApiKeyStatus,
  ApiKeyUsageAnalytics,
  ApiKeyUsageSummary,
  CreateApiKeyParams,
  CreatedApiKey,
  ListApiKeysParams,
  PermissionCatalog,
  PermissionCatalogEntry,
  UpdateApiKeyParams,
} from "./api-keys";
export { ApiKeys } from "./api-keys";
export type {
  Automation,
  AutomationCondition,
  AutomationEdge,
  AutomationGraph,
  AutomationLayoutParams,
  AutomationNode,
  AutomationParams,
  AutomationPosition,
} from "./automations";
export { Automations } from "./automations";
export { APIResource } from "./base";
export type {
  Campaign,
  CampaignAbVariant,
  CampaignAttachment,
  CampaignEstimate,
  CampaignFormStats,
  CampaignKind,
  CampaignLog,
  CampaignSegmentLink,
  CampaignStep,
  CreateCampaignParams,
  EstimateCampaignParams,
  ListCampaignsParams,
  StartCampaignParams,
  StepAction,
  StepBranch,
  StepBranchCondition,
  StepKind,
  StepLayoutParams,
  StepPosition,
  UpdateCampaignParams,
  UpdateCampaignStepParams,
} from "./campaigns";
export { Campaigns } from "./campaigns";
export type {
  AddContactParams,
  BatchResearchParams,
  Contact,
  ContactCampaignState,
  ContactCampaignStep,
  ContactImportParams,
  ContactNote,
  ContactResearchRun,
  ContactSearchParams,
  ContactSegmentMembership,
  ContactSource,
  ContactVerificationOverview,
  ContactVerificationParams,
  ContactVerificationResult,
  LeadEngagement,
  LeadStatus,
  ResearchArtifact,
  ResearchHook,
  ResearchParams,
  ResearchResult,
  ResearchSignal,
  VerificationStatus,
} from "./contacts";
export { Contacts } from "./contacts";
export type {
  CrmTask,
  CrmTaskType,
  Deal,
  Pipeline,
  PipelineStage,
} from "./crm";
export { Crm } from "./crm";
export type {
  BulkTagEmailsParams,
  DailySendingPlan,
  DomainAuthCheck,
  EmailAccount,
  EmailSyncStatus,
  ListEmailsParams,
  MailboxAllowance,
  MailboxAllowanceBasis,
  SendingBehavior,
  SendRotationState,
  TrackingDomainStatus,
  TrackingDomainVerification,
  UpdateEmailParams,
  UpdateSendingBehaviorParams,
  WarmupAction,
} from "./emails";
export { Emails } from "./emails";
export type {
  Form,
  FormAssetKind,
  FormDesign,
  FormField,
  FormStats,
  FormStatsBucket,
  FormStatus,
  FormSubmission,
  FormSubmissionList,
  FormsConfig,
  FormsDomainStatus,
  ListFormSubmissionsParams,
  UpdateFormParams,
} from "./forms";
export { Forms } from "./forms";
export type {
  AIVariableParams,
  EditParams,
  GenerationResult,
  GenerationUsage,
  WriteParams,
} from "./generation";
export { Generation } from "./generation";
export type {
  IntegrationCatalogEntry,
  IntegrationConnection,
  IntegrationEvent,
} from "./integrations";
export { Integrations } from "./integrations";
export type {
  CreateLeadSyncSourceParams,
  ImportColumnMapping,
  ImportDedupStrategy,
  LeadSyncConnection,
  LeadSyncSource,
  LeadSyncStatus,
  UpdateLeadSyncSourceParams,
} from "./lead-sync";
export { LeadSync } from "./lead-sync";
export type {
  CreateMeetingParams,
  ListMeetingsParams,
  Meeting,
  MeetingStatus,
} from "./meetings";
export { Meetings } from "./meetings";
export type {
  AuditLogEntry,
  AuthConfig,
  Category,
  DeliverabilityEventParams,
  DeliverabilityEventType,
  Folder,
  GroupOrder,
  Identity,
  ListDeadLettersParams,
  Plan,
  Tag,
  TaskDeadLetter,
  Team,
  WarmupRoutingRule,
} from "./misc";
export { Misc } from "./misc";
export type {
  CreateSegmentParams,
  PreviewSegmentParams,
  Segment,
  SegmentAddToCampaignResult,
  SegmentCondition,
  SegmentField,
  SegmentFieldKind,
  SegmentMatch,
  SegmentMemberMode,
  SegmentOverride,
  SetSegmentMembersParams,
  UpdateSegmentParams,
} from "./segments";
export { Segments } from "./segments";
export type {
  AddSuppressionsParams,
  AddSuppressionsResult,
  ListSuppressionsParams,
  Suppression,
  SuppressionEntryInput,
  SuppressionKind,
  SuppressionSource,
} from "./suppressions";
export { Suppressions } from "./suppressions";
export type { CreateTemplateParams, ListTemplatesParams, Template } from "./templates";
export { Templates } from "./templates";
export type {
  AgentDraft,
  AIDraft,
  ComposeCandidate,
  ComposeCandidates,
  ComposeDraft,
  ComposeDraftParams,
  ComposeParams,
  ComposeResult,
  DraftGrounding,
  ListUniboxParams,
  MarkSeenParams,
  ReplyDraftParams,
  SaveComposeDraftParams,
  UniboxFolder,
  UniboxItem,
  UniboxScheduledTask,
} from "./unibox";
export { Unibox } from "./unibox";
export type {
  ListDeliveriesParams,
  WebhookEndpoint,
  WebhookEndpointParams,
  WebhookEventDelivery,
  WebhookEventName,
  WebhookEventType,
} from "./webhooks";
export { WEBHOOK_EVENTS, WEBHOOK_FIREHOSE_EVENTS, Webhooks } from "./webhooks";
