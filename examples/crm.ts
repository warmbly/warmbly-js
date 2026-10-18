/**
 * CRM tour: build a pipeline with stages, create and search deals, move a deal
 * between stages, define task types and tasks, and pull summaries.
 * Run with: WARMBLY_API_KEY=wmbly_... npx tsx examples/crm.ts
 */
import { Warmbly } from "warmbly";

const warmbly = new Warmbly({ apiKey: process.env.WARMBLY_API_KEY });

// Create a pipeline. You can seed stages inline at creation time.
const pipeline = await warmbly.crm.createPipeline({
  name: "Sales",
  stages: [{ name: "Lead", color: "#94a3b8" }],
});
console.log("pipeline", pipeline.id);

// Add more stages to the pipeline one at a time.
const qualified = await warmbly.crm.createStage(pipeline.id, {
  name: "Qualified",
  color: "#0ea5e9",
});
const won = await warmbly.crm.createStage(pipeline.id, {
  name: "Won",
  color: "#22c55e",
});
console.log("stages", qualified.id, won.id);

// Create a deal in the pipeline, starting in the Qualified stage.
const deal = await warmbly.crm.createDeal({
  pipeline_id: pipeline.id,
  stage_id: qualified.id,
  contact_id: "c_1",
  name: "Acme rollout",
  value: 5000,
});
console.log("deal", deal.id);

// Search deals (for example by free-text query or by pipeline).
const matches = await warmbly.crm.searchDeals({
  query: "acme",
  pipeline_ids: [pipeline.id],
});
console.log("deal search", matches.data.length);

// Move the deal forward by updating its stage_id.
const moved = await warmbly.crm.updateDeal(deal.id, {
  stage_id: won.id,
});
console.log("moved deal to", moved.stage_id);

// Get an aggregate summary of deals in this pipeline (totals, counts by stage).
const dealSummary = await warmbly.crm.dealsSummary({
  pipeline_ids: [pipeline.id],
});
console.log("deals summary", dealSummary);

// Define task types so tasks can be categorized. A task references its type by name.
const callType = await warmbly.crm.createTaskType({ name: "Call" });
const emailType = await warmbly.crm.createTaskType({ name: "Follow-up email" });
console.log("task types", callType.id, emailType.id);

// Create a task tied to the deal and a contact.
const task = await warmbly.crm.createTask({
  title: "Call back about the rollout",
  type: "Call",
  contact_id: "c_1",
  deal_id: deal.id,
  due_date: "2026-06-16T15:00:00Z",
  priority: "high",
});
console.log("task", task.id);

// Pull a summary of tasks (for example open vs completed).
const taskSummary = await warmbly.crm.tasksSummary({
  statuses: ["pending", "in_progress"],
});
console.log("tasks summary", taskSummary);

// Bulk-complete every overdue task in one call. The selection can be an id list, or a
// filter ("select all matching") minus the ids you unticked.
const { affected } = await warmbly.crm.bulkUpdateTasks({
  all: true,
  filters: { overdue: true },
  status: "completed",
});
console.log("completed", affected, "overdue tasks");
