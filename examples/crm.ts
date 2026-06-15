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
  stages: [{ name: "Lead", position: 0 }],
});
console.log("pipeline", pipeline.id);

// Add more stages to the pipeline one at a time.
const qualified = await warmbly.crm.createStage(pipeline.id, {
  name: "Qualified",
  position: 1,
});
const won = await warmbly.crm.createStage(pipeline.id, {
  name: "Won",
  position: 2,
});
console.log("stages", qualified.id, won.id);

// Create a deal in the pipeline, starting in the Qualified stage.
const deal = await warmbly.crm.createDeal({
  pipeline_id: pipeline.id,
  stage_id: qualified.id,
  contact_id: "c_1",
  value: 5000,
});
console.log("deal", deal.id);

// Search deals (for example by free-text query or by pipeline).
const matches = await warmbly.crm.searchDeals({
  query: "acme",
  pipeline_id: pipeline.id,
});
console.log("deal search", matches);

// Move the deal forward by updating its stage_id.
const moved = await warmbly.crm.updateDeal(deal.id, {
  stage_id: won.id,
});
console.log("moved deal to", moved.stage_id);

// Get an aggregate summary of deals in this pipeline (totals, counts by stage).
const dealSummary = await warmbly.crm.dealsSummary({
  pipeline_id: pipeline.id,
});
console.log("deals summary", dealSummary);

// Define task types so tasks can be categorized.
const callType = await warmbly.crm.createTaskType({ name: "Call" });
const emailType = await warmbly.crm.createTaskType({ name: "Follow-up email" });
console.log("task types", callType.id, emailType.id);

// Create a task tied to the deal and a contact, due tomorrow.
const task = await warmbly.crm.createTask({
  task_type_id: callType.id,
  contact_id: "c_1",
  deal_id: deal.id,
  due_at: "2026-06-16T15:00:00Z",
});
console.log("task", task.id);

// Pull a summary of tasks (for example open vs completed).
const taskSummary = await warmbly.crm.tasksSummary({
  completed: false,
});
console.log("tasks summary", taskSummary);
