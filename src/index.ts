import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { z } from "zod";
import { n8nRequest, formatResponse } from "./api-client.js";

function createMcpServer(): McpServer {
  const server = new McpServer({ name: "n8n-mcp-server", version: "1.0.0" });

  // WORKFLOW TOOLS
  server.tool("n8n_list_workflows", "List all workflows. Supports filtering by tags, status, name, project.", { limit: z.number().int().min(1).max(250).default(20).describe("Max workflows (1-250)"), cursor: z.string().optional().describe("Pagination cursor"), tags: z.string().optional().describe("Comma-separated tag names"), name: z.string().optional().describe("Filter by name (partial match)"), projectId: z.string().optional().describe("Filter by project ID"), active: z.boolean().optional().describe("Filter by active/inactive") }, async (p) => { const r = await n8nRequest({ method: "GET", path: "/workflows", query: { limit: p.limit, cursor: p.cursor, tags: p.tags, name: p.name, projectId: p.projectId, active: p.active } }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_get_workflow", "Get a single workflow by ID including full node/connection definition.", { workflowId: z.string().describe("Workflow ID") }, async (p) => { const r = await n8nRequest({ method: "GET", path: `/workflows/${p.workflowId}` }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_create_workflow", "Create a new workflow.", { name: z.string().describe("Workflow name"), nodes: z.array(z.record(z.unknown())).describe("Array of node objects"), connections: z.record(z.unknown()).optional().describe("Connections between nodes"), settings: z.record(z.unknown()).optional().describe("Workflow settings"), staticData: z.union([z.string(), z.record(z.unknown())]).optional().describe("Static data") }, async (p) => { const b: Record<string, unknown> = { name: p.name, nodes: p.nodes }; if (p.connections) b.connections = p.connections; if (p.settings) b.settings = p.settings; if (p.staticData) b.staticData = p.staticData; const r = await n8nRequest({ method: "POST", path: "/workflows", body: b }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_update_workflow", "Update an existing workflow.", { workflowId: z.string().describe("Workflow ID"), name: z.string().optional().describe("New name"), nodes: z.array(z.record(z.unknown())).optional().describe("Updated nodes"), connections: z.record(z.unknown()).optional().describe("Updated connections"), settings: z.record(z.unknown()).optional().describe("Updated settings") }, async (p) => { const b: Record<string, unknown> = {}; if (p.name) b.name = p.name; if (p.nodes) b.nodes = p.nodes; if (p.connections) b.connections = p.connections; if (p.settings) b.settings = p.settings; const r = await n8nRequest({ method: "PUT", path: `/workflows/${p.workflowId}`, body: b }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_delete_workflow", "Delete a workflow permanently.", { workflowId: z.string().describe("Workflow ID") }, async (p) => { const r = await n8nRequest({ method: "DELETE", path: `/workflows/${p.workflowId}` }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_activate_workflow", "Activate (publish) a workflow.", { workflowId: z.string().describe("Workflow ID") }, async (p) => { const r = await n8nRequest({ method: "POST", path: `/workflows/${p.workflowId}/activate` }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_deactivate_workflow", "Deactivate a workflow.", { workflowId: z.string().describe("Workflow ID") }, async (p) => { const r = await n8nRequest({ method: "POST", path: `/workflows/${p.workflowId}/deactivate` }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_get_workflow_tags", "Get tags for a workflow.", { workflowId: z.string().describe("Workflow ID") }, async (p) => { const r = await n8nRequest({ method: "GET", path: `/workflows/${p.workflowId}/tags` }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_update_workflow_tags", "Set tags on a workflow (replaces existing).", { workflowId: z.string().describe("Workflow ID"), tagIds: z.array(z.object({ id: z.string() })).describe("Tag objects with id") }, async (p) => { const r = await n8nRequest({ method: "PUT", path: `/workflows/${p.workflowId}/tags`, body: p.tagIds }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_transfer_workflow", "Transfer a workflow to another project.", { workflowId: z.string().describe("Workflow ID"), destinationProjectId: z.string().describe("Target project ID") }, async (p) => { const r = await n8nRequest({ method: "PUT", path: `/workflows/${p.workflowId}/transfer`, body: { destinationProjectId: p.destinationProjectId } }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_get_workflow_version", "Get a specific workflow version from history.", { workflowId: z.string().describe("Workflow ID"), versionId: z.string().describe("Version ID") }, async (p) => { const r = await n8nRequest({ method: "GET", path: `/workflows/${p.workflowId}/versions/${p.versionId}` }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });

  // EXECUTION TOOLS
  server.tool("n8n_list_executions", "List executions with filtering.", { limit: z.number().int().min(1).max(250).default(20).describe("Max results"), cursor: z.string().optional().describe("Pagination cursor"), workflowId: z.string().optional().describe("Filter by workflow"), projectId: z.string().optional().describe("Filter by project"), status: z.enum(["canceled","crashed","error","new","running","success","unknown","waiting"]).optional().describe("Filter by status"), includeData: z.boolean().optional().describe("Include execution data") }, async (p) => { const r = await n8nRequest({ method: "GET", path: "/executions", query: { limit: p.limit, cursor: p.cursor, workflowId: p.workflowId, projectId: p.projectId, status: p.status, includeData: p.includeData } }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_get_execution", "Get execution details by ID.", { executionId: z.string().describe("Execution ID"), includeData: z.boolean().default(true).describe("Include full data") }, async (p) => { const r = await n8nRequest({ method: "GET", path: `/executions/${p.executionId}`, query: { includeData: p.includeData } }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_delete_execution", "Delete an execution.", { executionId: z.string().describe("Execution ID") }, async (p) => { const r = await n8nRequest({ method: "DELETE", path: `/executions/${p.executionId}` }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_retry_execution", "Retry a failed execution.", { executionId: z.string().describe("Execution ID"), loadWorkflow: z.boolean().default(false).describe("Use latest workflow version") }, async (p) => { const r = await n8nRequest({ method: "POST", path: `/executions/${p.executionId}/retry`, body: { loadWorkflow: p.loadWorkflow } }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_stop_execution", "Stop a running execution.", { executionId: z.string().describe("Execution ID") }, async (p) => { const r = await n8nRequest({ method: "POST", path: `/executions/${p.executionId}/stop` }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_stop_many_executions", "Stop multiple executions by filter.", { status: z.array(z.enum(["queued","running","waiting"])).describe("Statuses to stop"), workflowId: z.string().optional().describe("Filter by workflow"), startedAfter: z.string().optional().describe("ISO datetime"), startedBefore: z.string().optional().describe("ISO datetime") }, async (p) => { const b: Record<string, unknown> = { status: p.status }; if (p.workflowId) b.workflowId = p.workflowId; if (p.startedAfter) b.startedAfter = p.startedAfter; if (p.startedBefore) b.startedBefore = p.startedBefore; const r = await n8nRequest({ method: "POST", path: "/executions/stop", body: b }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_get_execution_tags", "Get annotation tags for an execution.", { executionId: z.string().describe("Execution ID") }, async (p) => { const r = await n8nRequest({ method: "GET", path: `/executions/${p.executionId}/tags` }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_update_execution_tags", "Update annotation tags of an execution.", { executionId: z.string().describe("Execution ID"), tagIds: z.array(z.object({ id: z.string() })).describe("Tag objects with id") }, async (p) => { const r = await n8nRequest({ method: "PUT", path: `/executions/${p.executionId}/tags`, body: p.tagIds }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });

  // CREDENTIAL TOOLS
  server.tool("n8n_list_credentials", "List all credentials (metadata only).", { limit: z.number().int().min(1).max(250).default(20).describe("Max results"), cursor: z.string().optional().describe("Pagination cursor") }, async (p) => { const r = await n8nRequest({ method: "GET", path: "/credentials", query: { limit: p.limit, cursor: p.cursor } }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_create_credential", "Create a new credential.", { name: z.string().describe("Display name"), type: z.string().describe("Credential type (e.g. slackApi, httpBasicAuth)"), data: z.record(z.unknown()).describe("Credential data fields") }, async (p) => { const r = await n8nRequest({ method: "POST", path: "/credentials", body: { name: p.name, type: p.type, data: p.data } }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_update_credential", "Update an existing credential.", { credentialId: z.string().describe("Credential ID"), name: z.string().optional().describe("New name"), data: z.record(z.unknown()).optional().describe("Updated data") }, async (p) => { const b: Record<string, unknown> = {}; if (p.name) b.name = p.name; if (p.data) b.data = p.data; const r = await n8nRequest({ method: "PATCH", path: `/credentials/${p.credentialId}`, body: b }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_delete_credential", "Delete a credential.", { credentialId: z.string().describe("Credential ID") }, async (p) => { const r = await n8nRequest({ method: "DELETE", path: `/credentials/${p.credentialId}` }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_get_credential_schema", "Get JSON schema for a credential type.", { credentialTypeName: z.string().describe("Credential type name") }, async (p) => { const r = await n8nRequest({ method: "GET", path: `/credentials/schema/${p.credentialTypeName}` }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_transfer_credential", "Transfer a credential to another project.", { credentialId: z.string().describe("Credential ID"), destinationProjectId: z.string().describe("Target project ID") }, async (p) => { const r = await n8nRequest({ method: "PUT", path: `/credentials/${p.credentialId}/transfer`, body: { destinationProjectId: p.destinationProjectId } }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });

  // TAG TOOLS
  server.tool("n8n_list_tags", "List all tags.", { limit: z.number().int().min(1).max(250).default(50).describe("Max results"), cursor: z.string().optional().describe("Pagination cursor") }, async (p) => { const r = await n8nRequest({ method: "GET", path: "/tags", query: { limit: p.limit, cursor: p.cursor } }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_get_tag", "Get a single tag by ID.", { tagId: z.string().describe("Tag ID") }, async (p) => { const r = await n8nRequest({ method: "GET", path: `/tags/${p.tagId}` }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_create_tag", "Create a new tag.", { name: z.string().describe("Tag name") }, async (p) => { const r = await n8nRequest({ method: "POST", path: "/tags", body: { name: p.name } }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_update_tag", "Update a tag's name.", { tagId: z.string().describe("Tag ID"), name: z.string().describe("New name") }, async (p) => { const r = await n8nRequest({ method: "PUT", path: `/tags/${p.tagId}`, body: { name: p.name } }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_delete_tag", "Delete a tag.", { tagId: z.string().describe("Tag ID") }, async (p) => { const r = await n8nRequest({ method: "DELETE", path: `/tags/${p.tagId}` }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });

  // VARIABLE TOOLS
  server.tool("n8n_list_variables", "List all variables.", { limit: z.number().int().min(1).max(250).default(50).describe("Max results"), cursor: z.string().optional().describe("Pagination cursor") }, async (p) => { const r = await n8nRequest({ method: "GET", path: "/variables", query: { limit: p.limit, cursor: p.cursor } }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_create_variable", "Create a new variable.", { key: z.string().describe("Variable key"), value: z.string().describe("Variable value") }, async (p) => { const r = await n8nRequest({ method: "POST", path: "/variables", body: { key: p.key, value: p.value } }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_delete_variable", "Delete a variable.", { variableId: z.string().describe("Variable ID") }, async (p) => { const r = await n8nRequest({ method: "DELETE", path: `/variables/${p.variableId}` }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });

  // USER TOOLS
  server.tool("n8n_list_users", "List all users (owner only).", { limit: z.number().int().min(1).max(250).default(20).describe("Max results"), cursor: z.string().optional().describe("Pagination cursor"), includeRole: z.boolean().default(true).describe("Include roles") }, async (p) => { const r = await n8nRequest({ method: "GET", path: "/users", query: { limit: p.limit, cursor: p.cursor, includeRole: p.includeRole } }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_get_user", "Get a user by ID or email.", { userIdentifier: z.string().describe("User ID or email") }, async (p) => { const r = await n8nRequest({ method: "GET", path: `/users/${p.userIdentifier}` }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_delete_user", "Delete a user (owner only).", { userId: z.string().describe("User ID"), transferId: z.string().optional().describe("Transfer workflows/credentials to this user") }, async (p) => { const r = await n8nRequest({ method: "DELETE", path: `/users/${p.userId}`, query: { transferId: p.transferId } }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_change_user_role", "Change a user's global role.", { userId: z.string().describe("User ID"), newRoleName: z.enum(["global:admin","global:member"]).describe("New role") }, async (p) => { const r = await n8nRequest({ method: "PATCH", path: `/users/${p.userId}/role`, body: { newRoleName: p.newRoleName } }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });

  // PROJECT TOOLS
  server.tool("n8n_list_projects", "List all projects.", { limit: z.number().int().min(1).max(250).default(20).describe("Max results"), cursor: z.string().optional().describe("Pagination cursor") }, async (p) => { const r = await n8nRequest({ method: "GET", path: "/projects", query: { limit: p.limit, cursor: p.cursor } }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_create_project", "Create a new project.", { name: z.string().describe("Project name") }, async (p) => { const r = await n8nRequest({ method: "POST", path: "/projects", body: { name: p.name } }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_get_project", "Get a project by ID with members and roles.", { projectId: z.string().describe("Project ID") }, async (p) => { const r = await n8nRequest({ method: "GET", path: `/projects/${p.projectId}` }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_update_project", "Update a project's name.", { projectId: z.string().describe("Project ID"), name: z.string().describe("New name") }, async (p) => { const r = await n8nRequest({ method: "PUT", path: `/projects/${p.projectId}`, body: { name: p.name } }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_delete_project", "Delete a project.", { projectId: z.string().describe("Project ID") }, async (p) => { const r = await n8nRequest({ method: "DELETE", path: `/projects/${p.projectId}` }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });

  // ADMIN TOOLS
  server.tool("n8n_run_audit", "Run a security audit.", { categories: z.array(z.string()).optional().describe("Audit categories: credentials, database, nodes, filesystem, instance") }, async (p) => { const b: Record<string, unknown> = {}; if (p.categories) b.categories = p.categories; const r = await n8nRequest({ method: "POST", path: "/audit", body: b }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });
  server.tool("n8n_source_control_pull", "Pull from connected Git repository (enterprise).", { force: z.boolean().default(false).describe("Force pull") }, async (p) => { const r = await n8nRequest({ method: "POST", path: "/source-control/pull", body: { force: p.force } }); return { content: [{ type: "text", text: formatResponse(r.data) }] }; });

  return server;
}

// SSE SERVER
const app = express();
const sessions = new Map<string, { transport: SSEServerTransport; server: McpServer }>();

app.get("/sse", async (_req, res) => {
  const server = createMcpServer();
  const transport = new SSEServerTransport("/messages", res);
  sessions.set(transport.sessionId, { transport, server });
  res.on("close", () => { sessions.delete(transport.sessionId); });
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const session = sessions.get(sessionId);
  if (!session) { res.status(400).json({ error: "Unknown session" }); return; }
  await session.transport.handlePostMessage(req, res);
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
