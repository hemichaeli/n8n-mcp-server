import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { z } from "zod";
import { n8nRequest, formatResponse } from "./api-client.js";

const server = new McpServer({
  name: "n8n-mcp-server",
  version: "1.0.0",
});

// WORKFLOW TOOLS

server.tool("n8n_list_workflows", "List all workflows. Supports filtering by tags, status, name, project, with cursor-based pagination.", {
  limit: z.number().int().min(1).max(250).default(20).describe("Max workflows to return (1-250)"),
  cursor: z.string().optional().describe("Pagination cursor from previous response"),
  tags: z.string().optional().describe("Comma-separated tag names to filter by"),
  name: z.string().optional().describe("Filter workflows by name (partial match)"),
  projectId: z.string().optional().describe("Filter by project ID"),
  active: z.boolean().optional().describe("Filter by active/inactive status"),
}, async (params) => {
  const res = await n8nRequest({ method: "GET", path: "/workflows", query: { limit: params.limit, cursor: params.cursor, tags: params.tags, name: params.name, projectId: params.projectId, active: params.active } });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_get_workflow", "Get a single workflow by ID, including its full node/connection definition.", {
  workflowId: z.string().describe("The workflow ID"),
}, async (params) => {
  const res = await n8nRequest({ method: "GET", path: `/workflows/${params.workflowId}` });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_create_workflow", "Create a new workflow in n8n.", {
  name: z.string().describe("Name for the new workflow"),
  nodes: z.array(z.record(z.unknown())).describe("Array of node objects defining the workflow"),
  connections: z.record(z.unknown()).optional().describe("Connections between nodes"),
  settings: z.record(z.unknown()).optional().describe("Workflow settings"),
  staticData: z.union([z.string(), z.record(z.unknown())]).optional().describe("Static data for the workflow"),
}, async (params) => {
  const body: Record<string, unknown> = { name: params.name, nodes: params.nodes };
  if (params.connections) body.connections = params.connections;
  if (params.settings) body.settings = params.settings;
  if (params.staticData) body.staticData = params.staticData;
  const res = await n8nRequest({ method: "POST", path: "/workflows", body });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_update_workflow", "Update an existing workflow. If active, the updated version is automatically re-published.", {
  workflowId: z.string().describe("The workflow ID to update"),
  name: z.string().optional().describe("New name for the workflow"),
  nodes: z.array(z.record(z.unknown())).optional().describe("Updated array of node objects"),
  connections: z.record(z.unknown()).optional().describe("Updated connections between nodes"),
  settings: z.record(z.unknown()).optional().describe("Updated workflow settings"),
}, async (params) => {
  const body: Record<string, unknown> = {};
  if (params.name) body.name = params.name;
  if (params.nodes) body.nodes = params.nodes;
  if (params.connections) body.connections = params.connections;
  if (params.settings) body.settings = params.settings;
  const res = await n8nRequest({ method: "PUT", path: `/workflows/${params.workflowId}`, body });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_delete_workflow", "Delete a workflow by ID permanently.", {
  workflowId: z.string().describe("The workflow ID to delete"),
}, async (params) => {
  const res = await n8nRequest({ method: "DELETE", path: `/workflows/${params.workflowId}` });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_activate_workflow", "Activate (publish) a workflow so it starts running on triggers.", {
  workflowId: z.string().describe("The workflow ID to activate"),
}, async (params) => {
  const res = await n8nRequest({ method: "POST", path: `/workflows/${params.workflowId}/activate` });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_deactivate_workflow", "Deactivate a workflow so it stops running on triggers.", {
  workflowId: z.string().describe("The workflow ID to deactivate"),
}, async (params) => {
  const res = await n8nRequest({ method: "POST", path: `/workflows/${params.workflowId}/deactivate` });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_get_workflow_tags", "Get all tags associated with a workflow.", {
  workflowId: z.string().describe("The workflow ID"),
}, async (params) => {
  const res = await n8nRequest({ method: "GET", path: `/workflows/${params.workflowId}/tags` });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_update_workflow_tags", "Update tags on a workflow. Replaces all existing tag associations.", {
  workflowId: z.string().describe("The workflow ID"),
  tagIds: z.array(z.object({ id: z.string() })).describe("Array of tag objects with 'id' field"),
}, async (params) => {
  const res = await n8nRequest({ method: "PUT", path: `/workflows/${params.workflowId}/tags`, body: params.tagIds });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_transfer_workflow", "Transfer a workflow to another project.", {
  workflowId: z.string().describe("The workflow ID to transfer"),
  destinationProjectId: z.string().describe("The project ID to transfer to"),
}, async (params) => {
  const res = await n8nRequest({ method: "PUT", path: `/workflows/${params.workflowId}/transfer`, body: { destinationProjectId: params.destinationProjectId } });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_get_workflow_version", "Get a specific version of a workflow from history.", {
  workflowId: z.string().describe("The workflow ID"),
  versionId: z.string().describe("The version ID to retrieve"),
}, async (params) => {
  const res = await n8nRequest({ method: "GET", path: `/workflows/${params.workflowId}/versions/${params.versionId}` });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

// EXECUTION TOOLS

server.tool("n8n_list_executions", "List executions with filtering and pagination.", {
  limit: z.number().int().min(1).max(250).default(20).describe("Max executions to return"),
  cursor: z.string().optional().describe("Pagination cursor"),
  workflowId: z.string().optional().describe("Filter by workflow ID"),
  projectId: z.string().optional().describe("Filter by project ID"),
  status: z.enum(["canceled", "crashed", "error", "new", "running", "success", "unknown", "waiting"]).optional().describe("Filter by execution status"),
  includeData: z.boolean().optional().describe("Include full execution data"),
}, async (params) => {
  const res = await n8nRequest({ method: "GET", path: "/executions", query: { limit: params.limit, cursor: params.cursor, workflowId: params.workflowId, projectId: params.projectId, status: params.status, includeData: params.includeData } });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_get_execution", "Get details of a specific execution by ID.", {
  executionId: z.string().describe("The execution ID"),
  includeData: z.boolean().default(true).describe("Include full execution data"),
}, async (params) => {
  const res = await n8nRequest({ method: "GET", path: `/executions/${params.executionId}`, query: { includeData: params.includeData } });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_delete_execution", "Delete a specific execution by ID.", {
  executionId: z.string().describe("The execution ID to delete"),
}, async (params) => {
  const res = await n8nRequest({ method: "DELETE", path: `/executions/${params.executionId}` });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_retry_execution", "Retry a failed or stopped execution.", {
  executionId: z.string().describe("The execution ID to retry"),
  loadWorkflow: z.boolean().default(false).describe("If true, retries with latest workflow version"),
}, async (params) => {
  const res = await n8nRequest({ method: "POST", path: `/executions/${params.executionId}/retry`, body: { loadWorkflow: params.loadWorkflow } });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_stop_execution", "Stop a running execution by ID.", {
  executionId: z.string().describe("The execution ID to stop"),
}, async (params) => {
  const res = await n8nRequest({ method: "POST", path: `/executions/${params.executionId}/stop` });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_stop_many_executions", "Stop multiple executions based on filter criteria.", {
  status: z.array(z.enum(["queued", "running", "waiting"])).describe("Statuses to stop"),
  workflowId: z.string().optional().describe("Filter by workflow ID"),
  startedAfter: z.string().optional().describe("Only stop executions started after this ISO datetime"),
  startedBefore: z.string().optional().describe("Only stop executions started before this ISO datetime"),
}, async (params) => {
  const body: Record<string, unknown> = { status: params.status };
  if (params.workflowId) body.workflowId = params.workflowId;
  if (params.startedAfter) body.startedAfter = params.startedAfter;
  if (params.startedBefore) body.startedBefore = params.startedBefore;
  const res = await n8nRequest({ method: "POST", path: "/executions/stop", body });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_get_execution_tags", "Get annotation tags for an execution.", {
  executionId: z.string().describe("The execution ID"),
}, async (params) => {
  const res = await n8nRequest({ method: "GET", path: `/executions/${params.executionId}/tags` });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_update_execution_tags", "Update annotation tags of an execution.", {
  executionId: z.string().describe("The execution ID"),
  tagIds: z.array(z.object({ id: z.string() })).describe("Array of tag objects with 'id' field"),
}, async (params) => {
  const res = await n8nRequest({ method: "PUT", path: `/executions/${params.executionId}/tags`, body: params.tagIds });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

// CREDENTIAL TOOLS

server.tool("n8n_list_credentials", "List all credentials (metadata only, no secrets).", {
  limit: z.number().int().min(1).max(250).default(20).describe("Max credentials to return"),
  cursor: z.string().optional().describe("Pagination cursor"),
}, async (params) => {
  const res = await n8nRequest({ method: "GET", path: "/credentials", query: { limit: params.limit, cursor: params.cursor } });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_create_credential", "Create a new credential.", {
  name: z.string().describe("Display name"),
  type: z.string().describe("Credential type (e.g. 'slackApi', 'httpBasicAuth')"),
  data: z.record(z.unknown()).describe("Credential data fields"),
}, async (params) => {
  const res = await n8nRequest({ method: "POST", path: "/credentials", body: { name: params.name, type: params.type, data: params.data } });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_update_credential", "Update an existing credential.", {
  credentialId: z.string().describe("The credential ID to update"),
  name: z.string().optional().describe("New display name"),
  data: z.record(z.unknown()).optional().describe("Updated credential data fields"),
}, async (params) => {
  const body: Record<string, unknown> = {};
  if (params.name) body.name = params.name;
  if (params.data) body.data = params.data;
  const res = await n8nRequest({ method: "PATCH", path: `/credentials/${params.credentialId}`, body });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_delete_credential", "Delete a credential by ID.", {
  credentialId: z.string().describe("The credential ID to delete"),
}, async (params) => {
  const res = await n8nRequest({ method: "DELETE", path: `/credentials/${params.credentialId}` });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_get_credential_schema", "Get JSON schema for a credential type.", {
  credentialTypeName: z.string().describe("Credential type name (e.g. 'slackApi')"),
}, async (params) => {
  const res = await n8nRequest({ method: "GET", path: `/credentials/schema/${params.credentialTypeName}` });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_transfer_credential", "Transfer a credential to another project.", {
  credentialId: z.string().describe("The credential ID to transfer"),
  destinationProjectId: z.string().describe("The project ID to transfer to"),
}, async (params) => {
  const res = await n8nRequest({ method: "PUT", path: `/credentials/${params.credentialId}/transfer`, body: { destinationProjectId: params.destinationProjectId } });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

// TAG TOOLS

server.tool("n8n_list_tags", "List all tags.", {
  limit: z.number().int().min(1).max(250).default(50).describe("Max tags to return"),
  cursor: z.string().optional().describe("Pagination cursor"),
}, async (params) => {
  const res = await n8nRequest({ method: "GET", path: "/tags", query: { limit: params.limit, cursor: params.cursor } });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_get_tag", "Get a single tag by ID.", {
  tagId: z.string().describe("The tag ID"),
}, async (params) => {
  const res = await n8nRequest({ method: "GET", path: `/tags/${params.tagId}` });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_create_tag", "Create a new tag.", {
  name: z.string().describe("Tag name"),
}, async (params) => {
  const res = await n8nRequest({ method: "POST", path: "/tags", body: { name: params.name } });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_update_tag", "Update a tag's name.", {
  tagId: z.string().describe("The tag ID"),
  name: z.string().describe("New tag name"),
}, async (params) => {
  const res = await n8nRequest({ method: "PUT", path: `/tags/${params.tagId}`, body: { name: params.name } });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_delete_tag", "Delete a tag by ID.", {
  tagId: z.string().describe("The tag ID to delete"),
}, async (params) => {
  const res = await n8nRequest({ method: "DELETE", path: `/tags/${params.tagId}` });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

// VARIABLE TOOLS

server.tool("n8n_list_variables", "List all variables (config values accessible across workflows).", {
  limit: z.number().int().min(1).max(250).default(50).describe("Max variables to return"),
  cursor: z.string().optional().describe("Pagination cursor"),
}, async (params) => {
  const res = await n8nRequest({ method: "GET", path: "/variables", query: { limit: params.limit, cursor: params.cursor } });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_create_variable", "Create a new variable.", {
  key: z.string().describe("Variable key/name"),
  value: z.string().describe("Variable value"),
}, async (params) => {
  const res = await n8nRequest({ method: "POST", path: "/variables", body: { key: params.key, value: params.value } });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_delete_variable", "Delete a variable by ID.", {
  variableId: z.string().describe("The variable ID to delete"),
}, async (params) => {
  const res = await n8nRequest({ method: "DELETE", path: `/variables/${params.variableId}` });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

// USER TOOLS

server.tool("n8n_list_users", "List all users (owner only).", {
  limit: z.number().int().min(1).max(250).default(20).describe("Max users to return"),
  cursor: z.string().optional().describe("Pagination cursor"),
  includeRole: z.boolean().default(true).describe("Include user roles"),
}, async (params) => {
  const res = await n8nRequest({ method: "GET", path: "/users", query: { limit: params.limit, cursor: params.cursor, includeRole: params.includeRole } });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_get_user", "Get a user by ID or email.", {
  userIdentifier: z.string().describe("User ID or email address"),
}, async (params) => {
  const res = await n8nRequest({ method: "GET", path: `/users/${params.userIdentifier}` });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_delete_user", "Delete a user (owner only).", {
  userId: z.string().describe("The user ID to delete"),
  transferId: z.string().optional().describe("User ID to transfer workflows/credentials to"),
}, async (params) => {
  const res = await n8nRequest({ method: "DELETE", path: `/users/${params.userId}`, query: { transferId: params.transferId } });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_change_user_role", "Change a user's global role.", {
  userId: z.string().describe("The user ID"),
  newRoleName: z.enum(["global:admin", "global:member"]).describe("The new role"),
}, async (params) => {
  const res = await n8nRequest({ method: "PATCH", path: `/users/${params.userId}/role`, body: { newRoleName: params.newRoleName } });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

// PROJECT TOOLS

server.tool("n8n_list_projects", "List all projects.", {
  limit: z.number().int().min(1).max(250).default(20).describe("Max projects to return"),
  cursor: z.string().optional().describe("Pagination cursor"),
}, async (params) => {
  const res = await n8nRequest({ method: "GET", path: "/projects", query: { limit: params.limit, cursor: params.cursor } });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_create_project", "Create a new project.", {
  name: z.string().describe("Project name"),
}, async (params) => {
  const res = await n8nRequest({ method: "POST", path: "/projects", body: { name: params.name } });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_get_project", "Get a project by ID with members and roles.", {
  projectId: z.string().describe("The project ID"),
}, async (params) => {
  const res = await n8nRequest({ method: "GET", path: `/projects/${params.projectId}` });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_update_project", "Update a project's name.", {
  projectId: z.string().describe("The project ID"),
  name: z.string().describe("New project name"),
}, async (params) => {
  const res = await n8nRequest({ method: "PUT", path: `/projects/${params.projectId}`, body: { name: params.name } });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_delete_project", "Delete a project.", {
  projectId: z.string().describe("The project ID to delete"),
}, async (params) => {
  const res = await n8nRequest({ method: "DELETE", path: `/projects/${params.projectId}` });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

// AUDIT & SOURCE CONTROL TOOLS

server.tool("n8n_run_audit", "Run a security audit on the n8n instance.", {
  categories: z.array(z.string()).optional().describe("Audit categories: credentials, database, nodes, filesystem, instance"),
}, async (params) => {
  const body: Record<string, unknown> = {};
  if (params.categories) body.categories = params.categories;
  const res = await n8nRequest({ method: "POST", path: "/audit", body });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

server.tool("n8n_source_control_pull", "Pull changes from connected Git repository (enterprise).", {
  force: z.boolean().default(false).describe("Force pull, overwriting local changes"),
}, async (params) => {
  const res = await n8nRequest({ method: "POST", path: "/source-control/pull", body: { force: params.force } });
  return { content: [{ type: "text", text: formatResponse(res.data) }] };
});

// SSE SERVER TRANSPORT

const app = express();
const sessions = new Map<string, SSEServerTransport>();

app.get("/sse", async (_req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  sessions.set(transport.sessionId, transport);
  res.on("close", () => { sessions.delete(transport.sessionId); });
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = sessions.get(sessionId);
  if (!transport) { res.status(400).json({ error: "Unknown session" }); return; }
  await transport.handlePostMessage(req, res);
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "n8n-mcp-server", version: "1.0.0", sessions: sessions.size, n8nConfigured: !!process.env.N8N_API_KEY });
});

const PORT = parseInt(process.env.PORT || "3000");
app.listen(PORT, () => {
  console.log(`n8n MCP server listening on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`N8N_BASE_URL: ${process.env.N8N_BASE_URL || "(not set)"}`);
  console.log(`N8N_API_KEY: ${process.env.N8N_API_KEY ? "configured" : "NOT SET"}`);
});
