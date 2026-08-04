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
  CampaignLog,
  CampaignStep,
  CreateCampaignParams,
  ListCampaignsParams,
  StepLayoutParams,
  StepPosition,
  UpdateCampaignParams,
} from "./campaigns";
export { Campaigns } from "./campaigns";
export type {
  AddContactParams,
  BatchResearchParams,
  Contact,
  ContactNote,
  ContactResearchRun,
  ContactSearchParams,
  ResearchArtifact,
  ResearchHook,
  ResearchParams,
  ResearchResult,
  ResearchSignal,
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
  EmailAccount,
  ListEmailsParams,
  WarmupAction,
} from "./emails";
export { Emails } from "./emails";
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
  Category,
  DeliverabilityEventParams,
  DeliverabilityEventType,
  Folder,
  Identity,
  ListDeadLettersParams,
  Plan,
  Tag,
  TaskDeadLetter,
  Team,
  WarmupRoutingRule,
} from "./misc";
export { Misc } from "./misc";
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
  ReplyDraftParams,
  SaveComposeDraftParams,
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
