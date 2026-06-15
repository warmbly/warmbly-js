/** Public barrel for the REST resource pillar: resource classes plus their types. */

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
export { APIResource } from "./base";
export type {
  Campaign,
  CampaignAbVariant,
  CampaignAttachment,
  CampaignLog,
  CampaignStep,
  CreateCampaignParams,
  ListCampaignsParams,
  UpdateCampaignParams,
} from "./campaigns";
export { Campaigns } from "./campaigns";
export type {
  AddContactParams,
  Contact,
  ContactNote,
  ContactSearchParams,
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
export type { EmailAccount, ListEmailsParams, WarmupAction } from "./emails";
export { Emails } from "./emails";
export type {
  IntegrationCatalogEntry,
  IntegrationConnection,
  IntegrationEvent,
} from "./integrations";
export { Integrations } from "./integrations";
export type {
  AuditLogEntry,
  Category,
  Folder,
  Plan,
  Tag,
  Team,
  WarmupRoutingRule,
} from "./misc";
export { Misc } from "./misc";
export type { CreateTemplateParams, ListTemplatesParams, Template } from "./templates";
export { Templates } from "./templates";
export type { ListUniboxParams, UniboxItem, UniboxScheduledTask } from "./unibox";
export { Unibox } from "./unibox";
export type {
  ListDeliveriesParams,
  WebhookEndpoint,
  WebhookEndpointParams,
  WebhookEventDelivery,
  WebhookEventType,
} from "./webhooks";
export { Webhooks } from "./webhooks";
