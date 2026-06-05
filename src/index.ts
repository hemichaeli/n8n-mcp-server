import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { z } from "zod";
import { n8nRequest, formatResponse } from "./api-client.js";

function createMcpServer(): McpServer {
  const server = new McpServer({ name: "n8n-mcp-server", version: "2.0.0" });

  // HEALTH / UTILITY
  server.tool("n8n_health_check", "Check connectivity to n8n. Returns version and status.", {}, async () => {
    try {
      const r = await n8nRequest({ method: "GET", path: "/health" });
      return { content: [{ type: "text", text: formatResponse(r.data) }] };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { content: [{ type: "text", text: `Health check failed: ${msg}` }] };
    }
  });

  server.tool("n8n_discover", "Discover what features are available on this n8n instance.", {}, async () => {
    try {
      const r = await n8nRequest({ method: "GET", path: "/discovery" });
      return { content: [{ type: "text", text: formatResponse(r.data) }] };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { content: [{ type: "text", text: `Discovery failed: ${msg}` }] };
    }
  });

  server.tool("n8n_raw_request", "Escape hatch: make any HTTP request to the n8n API. Use when no specific tool exists.", {
    method: z.enum(["GET","POST","PUT","PATCH","DELETE"]).describe("HTTP method"),
    path: z.string().describe("API path (e.g. /workflows or /executions/123)"),
    body: z.record(z.unknown()).optional().describe("Request body for POST/PUT/PATCH"),
    query: z.record(z.string()).optional().describe("Query parameters")
  }, async (p) => {
    const r = await n8nRequest({ method: p.method, path: p.path, body: p.body, query: p.query });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  // WORKFLOW TOOLS
  server.tool("n8n_list_workflows", "List all workflows with optional filtering.", {
    limit: z.number().int().min(1).max(250).default(20).describe("Max workflows (1-250)"),
    cursor: z.string().optional().describe("Pagination cursor"),
    tags: z.string().optional().describe("Comma-separated tag names"),
    name: z.string().optional().describe("Filter by name (partial match)"),
    projectId: z.string().optional().describe("Filter by project ID"),
    active: z.boolean().optional().describe("Filter by active/inactive")
  }, async (p) => {
    const r = await n8nRequest({ method: "GET", path: "/workflows", query: { limit: p.limit, cursor: p.cursor, tags: p.tags, name: p.name, projectId: p.projectId, active: p.active } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_get_workflow", "Get a single workflow by ID including full node/connection definition.", {
    workflowId: z.string().describe("Workflow ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "GET", path: `/workflows/${p.workflowId}` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_create_workflow", "Create a new workflow.", {
    name: z.string().describe("Workflow name"),
    nodes: z.array(z.record(z.unknown())).describe("Array of node objects"),
    connections: z.record(z.unknown()).optional().describe("Connections between nodes"),
    settings: z.record(z.unknown()).optional().describe("Workflow settings"),
    staticData: z.union([z.string(), z.record(z.unknown())]).optional().describe("Static data")
  }, async (p) => {
    const b: Record<string, unknown> = { name: p.name, nodes: p.nodes };
    if (p.connections) b.connections = p.connections;
    if (p.settings) b.settings = p.settings;
    if (p.staticData) b.staticData = p.staticData;
    const r = await n8nRequest({ method: "POST", path: "/workflows", body: b });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_update_workflow", "Update an existing workflow (PUT - replaces entire workflow). Always fetch first with n8n_get_workflow.", {
    workflowId: z.string().describe("Workflow ID"),
    name: z.string().optional().describe("New name"),
    nodes: z.array(z.record(z.unknown())).optional().describe("Updated nodes"),
    connections: z.record(z.unknown()).optional().describe("Updated connections"),
    settings: z.record(z.unknown()).optional().describe("Updated settings")
  }, async (p) => {
    const b: Record<string, unknown> = {};
    if (p.name) b.name = p.name;
    if (p.nodes) b.nodes = p.nodes;
    if (p.connections) b.connections = p.connections;
    if (p.settings) b.settings = p.settings;
    const r = await n8nRequest({ method: "PUT", path: `/workflows/${p.workflowId}`, body: b });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_delete_workflow", "Delete a workflow permanently.", {
    workflowId: z.string().describe("Workflow ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "DELETE", path: `/workflows/${p.workflowId}` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_activate_workflow", "Activate (publish) a workflow so it runs on triggers.", {
    workflowId: z.string().describe("Workflow ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "POST", path: `/workflows/${p.workflowId}/activate` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_deactivate_workflow", "Deactivate a workflow.", {
    workflowId: z.string().describe("Workflow ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "POST", path: `/workflows/${p.workflowId}/deactivate` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_archive_workflow", "Archive a workflow (soft delete - recoverable).", {
    workflowId: z.string().describe("Workflow ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "POST", path: `/workflows/${p.workflowId}/archive` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_unarchive_workflow", "Unarchive a previously archived workflow.", {
    workflowId: z.string().describe("Workflow ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "POST", path: `/workflows/${p.workflowId}/unarchive` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_get_workflow_tags", "Get tags for a workflow.", {
    workflowId: z.string().describe("Workflow ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "GET", path: `/workflows/${p.workflowId}/tags` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_set_workflow_tags", "Set tags on a workflow (replaces existing tag set).", {
    workflowId: z.string().describe("Workflow ID"),
    tagIds: z.array(z.object({ id: z.string() })).describe("Tag objects with id field")
  }, async (p) => {
    const r = await n8nRequest({ method: "PUT", path: `/workflows/${p.workflowId}/tags`, body: p.tagIds });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_transfer_workflow", "Transfer a workflow to another project.", {
    workflowId: z.string().describe("Workflow ID"),
    destinationProjectId: z.string().describe("Target project ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "PUT", path: `/workflows/${p.workflowId}/transfer`, body: { destinationProjectId: p.destinationProjectId } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_get_workflow_version", "Get a specific workflow version from history.", {
    workflowId: z.string().describe("Workflow ID"),
    versionId: z.string().describe("Version ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "GET", path: `/workflows/${p.workflowId}/versions/${p.versionId}` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_trigger_workflow_webhook", "Trigger a workflow via its webhook URL. Only works if workflow has a Webhook node.", {
    webhookPath: z.string().describe("Webhook path (e.g. my-webhook or /webhook/my-path)"),
    method: z.enum(["GET","POST","PUT","PATCH","DELETE"]).default("POST").describe("HTTP method"),
    body: z.record(z.unknown()).optional().describe("Request body"),
    query: z.record(z.string()).optional().describe("Query parameters")
  }, async (p) => {
    const path = p.webhookPath.startsWith("/") ? p.webhookPath : `/webhook/${p.webhookPath}`;
    const r = await n8nRequest({ method: p.method, path, body: p.body, query: p.query });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  // EXECUTION TOOLS
  server.tool("n8n_list_executions", "List executions with filtering.", {
    limit: z.number().int().min(1).max(250).default(20).describe("Max results"),
    cursor: z.string().optional().describe("Pagination cursor"),
    workflowId: z.string().optional().describe("Filter by workflow"),
    projectId: z.string().optional().describe("Filter by project"),
    status: z.enum(["canceled","crashed","error","new","running","success","unknown","waiting"]).optional().describe("Filter by status"),
    includeData: z.boolean().optional().describe("Include execution data")
  }, async (p) => {
    const r = await n8nRequest({ method: "GET", path: "/executions", query: { limit: p.limit, cursor: p.cursor, workflowId: p.workflowId, projectId: p.projectId, status: p.status, includeData: p.includeData } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_get_execution", "Get execution details by ID.", {
    executionId: z.string().describe("Execution ID"),
    includeData: z.boolean().default(true).describe("Include full execution data")
  }, async (p) => {
    const r = await n8nRequest({ method: "GET", path: `/executions/${p.executionId}`, query: { includeData: p.includeData } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_delete_execution", "Delete an execution.", {
    executionId: z.string().describe("Execution ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "DELETE", path: `/executions/${p.executionId}` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_retry_execution", "Retry a failed execution.", {
    executionId: z.string().describe("Execution ID"),
    loadWorkflow: z.boolean().default(false).describe("Use latest workflow version instead of saved one")
  }, async (p) => {
    const r = await n8nRequest({ method: "POST", path: `/executions/${p.executionId}/retry`, body: { loadWorkflow: p.loadWorkflow } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_stop_execution", "Stop a running execution.", {
    executionId: z.string().describe("Execution ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "POST", path: `/executions/${p.executionId}/stop` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_stop_many_executions", "Stop multiple executions matching a filter.", {
    status: z.array(z.enum(["queued","running","waiting"])).describe("Statuses to stop"),
    workflowId: z.string().optional().describe("Filter by workflow"),
    startedAfter: z.string().optional().describe("ISO datetime"),
    startedBefore: z.string().optional().describe("ISO datetime")
  }, async (p) => {
    const b: Record<string, unknown> = { status: p.status };
    if (p.workflowId) b.workflowId = p.workflowId;
    if (p.startedAfter) b.startedAfter = p.startedAfter;
    if (p.startedBefore) b.startedBefore = p.startedBefore;
    const r = await n8nRequest({ method: "POST", path: "/executions/stop", body: b });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_get_execution_tags", "Get annotation tags for an execution.", {
    executionId: z.string().describe("Execution ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "GET", path: `/executions/${p.executionId}/tags` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_update_execution_tags", "Update annotation tags of an execution.", {
    executionId: z.string().describe("Execution ID"),
    tagIds: z.array(z.object({ id: z.string() })).describe("Tag objects with id")
  }, async (p) => {
    const r = await n8nRequest({ method: "PUT", path: `/executions/${p.executionId}/tags`, body: p.tagIds });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  // CREDENTIAL TOOLS
  server.tool("n8n_list_credentials", "List all credentials (metadata only, no secrets).", {
    limit: z.number().int().min(1).max(250).default(20).describe("Max results"),
    cursor: z.string().optional().describe("Pagination cursor")
  }, async (p) => {
    const r = await n8nRequest({ method: "GET", path: "/credentials", query: { limit: p.limit, cursor: p.cursor } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_create_credential", "Create a new credential.", {
    name: z.string().describe("Display name"),
    type: z.string().describe("Credential type (e.g. slackApi, httpBasicAuth, googleDriveOAuth2Api)"),
    data: z.record(z.unknown()).describe("Credential data fields - use n8n_get_credential_schema to discover fields")
  }, async (p) => {
    const r = await n8nRequest({ method: "POST", path: "/credentials", body: { name: p.name, type: p.type, data: p.data } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_update_credential", "Update an existing credential.", {
    credentialId: z.string().describe("Credential ID"),
    name: z.string().optional().describe("New name"),
    data: z.record(z.unknown()).optional().describe("Updated data fields")
  }, async (p) => {
    const b: Record<string, unknown> = {};
    if (p.name) b.name = p.name;
    if (p.data) b.data = p.data;
    const r = await n8nRequest({ method: "PATCH", path: `/credentials/${p.credentialId}`, body: b });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_delete_credential", "Delete a credential.", {
    credentialId: z.string().describe("Credential ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "DELETE", path: `/credentials/${p.credentialId}` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_get_credential_schema", "Get JSON schema for a credential type to know what fields to provide.", {
    credentialTypeName: z.string().describe("Credential type name (e.g. slackApi, googleDriveOAuth2Api)")
  }, async (p) => {
    const r = await n8nRequest({ method: "GET", path: `/credentials/schema/${p.credentialTypeName}` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_transfer_credential", "Transfer a credential to another project.", {
    credentialId: z.string().describe("Credential ID"),
    destinationProjectId: z.string().describe("Target project ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "PUT", path: `/credentials/${p.credentialId}/transfer`, body: { destinationProjectId: p.destinationProjectId } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  // TAG TOOLS
  server.tool("n8n_list_tags", "List all workflow tags.", {
    limit: z.number().int().min(1).max(250).default(50).describe("Max results"),
    cursor: z.string().optional().describe("Pagination cursor")
  }, async (p) => {
    const r = await n8nRequest({ method: "GET", path: "/tags", query: { limit: p.limit, cursor: p.cursor } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_get_tag", "Get a single tag by ID.", {
    tagId: z.string().describe("Tag ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "GET", path: `/tags/${p.tagId}` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_create_tag", "Create a new workflow tag.", {
    name: z.string().describe("Tag name")
  }, async (p) => {
    const r = await n8nRequest({ method: "POST", path: "/tags", body: { name: p.name } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_update_tag", "Update a tag name.", {
    tagId: z.string().describe("Tag ID"),
    name: z.string().describe("New name")
  }, async (p) => {
    const r = await n8nRequest({ method: "PUT", path: `/tags/${p.tagId}`, body: { name: p.name } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_delete_tag", "Delete a tag.", {
    tagId: z.string().describe("Tag ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "DELETE", path: `/tags/${p.tagId}` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  // VARIABLE TOOLS (Enterprise)
  server.tool("n8n_list_variables", "List all instance-wide variables ($vars.foo in workflows). Enterprise feature.", {
    limit: z.number().int().min(1).max(250).default(50).describe("Max results"),
    cursor: z.string().optional().describe("Pagination cursor")
  }, async (p) => {
    const r = await n8nRequest({ method: "GET", path: "/variables", query: { limit: p.limit, cursor: p.cursor } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_create_variable", "Create a new instance-wide variable. Enterprise feature.", {
    key: z.string().describe("Variable key (referenced as $vars.key in workflows)"),
    value: z.string().describe("Variable value")
  }, async (p) => {
    const r = await n8nRequest({ method: "POST", path: "/variables", body: { key: p.key, value: p.value } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_update_variable", "Update an existing variable. Enterprise feature.", {
    variableId: z.string().describe("Variable ID"),
    key: z.string().optional().describe("New key"),
    value: z.string().optional().describe("New value")
  }, async (p) => {
    const b: Record<string, unknown> = {};
    if (p.key) b.key = p.key;
    if (p.value) b.value = p.value;
    const r = await n8nRequest({ method: "PATCH", path: `/variables/${p.variableId}`, body: b });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_delete_variable", "Delete a variable. Enterprise feature.", {
    variableId: z.string().describe("Variable ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "DELETE", path: `/variables/${p.variableId}` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  // USER TOOLS (Owner/Admin only)
  server.tool("n8n_list_users", "List all users. Requires owner or admin role.", {
    limit: z.number().int().min(1).max(250).default(20).describe("Max results"),
    cursor: z.string().optional().describe("Pagination cursor"),
    includeRole: z.boolean().default(true).describe("Include role information")
  }, async (p) => {
    const r = await n8nRequest({ method: "GET", path: "/users", query: { limit: p.limit, cursor: p.cursor, includeRole: p.includeRole } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_get_user", "Get a user by ID or email address.", {
    userIdentifier: z.string().describe("User ID or email")
  }, async (p) => {
    const r = await n8nRequest({ method: "GET", path: `/users/${p.userIdentifier}` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_create_user", "Invite a new user to the n8n instance.", {
    email: z.string().email().describe("User email address"),
    role: z.enum(["global:admin","global:member"]).default("global:member").describe("User role")
  }, async (p) => {
    const r = await n8nRequest({ method: "POST", path: "/users", body: [{ email: p.email, role: p.role }] });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_delete_user", "Delete a user. Requires owner role.", {
    userId: z.string().describe("User ID"),
    transferId: z.string().optional().describe("Transfer this user's workflows/credentials to this user ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "DELETE", path: `/users/${p.userId}`, query: { transferId: p.transferId } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_change_user_role", "Change a user global role.", {
    userId: z.string().describe("User ID"),
    newRoleName: z.enum(["global:admin","global:member"]).describe("New global role")
  }, async (p) => {
    const r = await n8nRequest({ method: "PATCH", path: `/users/${p.userId}/role`, body: { newRoleName: p.newRoleName } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  // PROJECT TOOLS (Enterprise)
  server.tool("n8n_list_projects", "List all projects. Enterprise feature.", {
    limit: z.number().int().min(1).max(250).default(20).describe("Max results"),
    cursor: z.string().optional().describe("Pagination cursor")
  }, async (p) => {
    const r = await n8nRequest({ method: "GET", path: "/projects", query: { limit: p.limit, cursor: p.cursor } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_create_project", "Create a new project. Enterprise feature.", {
    name: z.string().describe("Project name")
  }, async (p) => {
    const r = await n8nRequest({ method: "POST", path: "/projects", body: { name: p.name } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_get_project", "Get a project by ID with members and roles. Enterprise feature.", {
    projectId: z.string().describe("Project ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "GET", path: `/projects/${p.projectId}` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_update_project", "Update a project name. Enterprise feature.", {
    projectId: z.string().describe("Project ID"),
    name: z.string().describe("New name")
  }, async (p) => {
    const r = await n8nRequest({ method: "PUT", path: `/projects/${p.projectId}`, body: { name: p.name } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_delete_project", "Delete a project. Enterprise feature.", {
    projectId: z.string().describe("Project ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "DELETE", path: `/projects/${p.projectId}` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  // FOLDER TOOLS (Enterprise)
  server.tool("n8n_list_folders", "List folders inside a project. Enterprise feature.", {
    projectId: z.string().describe("Project ID"),
    limit: z.number().int().min(1).max(250).default(20).describe("Max results"),
    cursor: z.string().optional().describe("Pagination cursor"),
    parentFolderId: z.string().optional().describe("Filter by parent folder ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "GET", path: `/projects/${p.projectId}/folders`, query: { limit: p.limit, cursor: p.cursor, parentFolderId: p.parentFolderId } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_create_folder", "Create a folder inside a project. Enterprise feature.", {
    projectId: z.string().describe("Project ID"),
    name: z.string().describe("Folder name"),
    parentFolderId: z.string().optional().describe("Parent folder ID for nesting")
  }, async (p) => {
    const b: Record<string, unknown> = { name: p.name };
    if (p.parentFolderId) b.parentFolderId = p.parentFolderId;
    const r = await n8nRequest({ method: "POST", path: `/projects/${p.projectId}/folders`, body: b });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_get_folder", "Get a specific folder. Enterprise feature.", {
    projectId: z.string().describe("Project ID"),
    folderId: z.string().describe("Folder ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "GET", path: `/projects/${p.projectId}/folders/${p.folderId}` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_update_folder", "Update a folder name. Enterprise feature.", {
    projectId: z.string().describe("Project ID"),
    folderId: z.string().describe("Folder ID"),
    name: z.string().describe("New folder name")
  }, async (p) => {
    const r = await n8nRequest({ method: "PUT", path: `/projects/${p.projectId}/folders/${p.folderId}`, body: { name: p.name } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_delete_folder", "Delete a folder. Enterprise feature.", {
    projectId: z.string().describe("Project ID"),
    folderId: z.string().describe("Folder ID")
  }, async (p) => {
    const r = await n8nRequest({ method: "DELETE", path: `/projects/${p.projectId}/folders/${p.folderId}` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  // COMMUNITY PACKAGE TOOLS
  server.tool("n8n_list_community_packages", "List installed community node packages.", {}, async () => {
    const r = await n8nRequest({ method: "GET", path: "/community-packages" });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_install_community_package", "Install a community node package from npm.", {
    packageName: z.string().describe("npm package name (e.g. n8n-nodes-discord)")
  }, async (p) => {
    const r = await n8nRequest({ method: "POST", path: "/community-packages", body: { packageName: p.packageName } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_update_community_package", "Update an installed community node package to latest version.", {
    packageName: z.string().describe("npm package name")
  }, async (p) => {
    const r = await n8nRequest({ method: "PATCH", path: `/community-packages/${encodeURIComponent(p.packageName)}` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  server.tool("n8n_uninstall_community_package", "Uninstall a community node package.", {
    packageName: z.string().describe("npm package name")
  }, async (p) => {
    const r = await n8nRequest({ method: "DELETE", path: `/community-packages/${encodeURIComponent(p.packageName)}` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  // INSIGHTS TOOL (Enterprise)
  server.tool("n8n_get_insights", "Get workflow execution insights summary (Enterprise feature).", {
    type: z.enum(["summary","by-workflow","by-time"]).default("summary").describe("Type of insights to fetch")
  }, async (p) => {
    const r = await n8nRequest({ method: "GET", path: `/insights/${p.type}` });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  // AUDIT TOOL
  server.tool("n8n_run_audit", "Run a security audit on the n8n instance.", {
    categories: z.array(z.enum(["credentials","database","nodes","filesystem","instance"])).optional().describe("Audit categories to include. Omit for all.")
  }, async (p) => {
    const b: Record<string, unknown> = {};
    if (p.categories) b.categories = p.categories;
    const r = await n8nRequest({ method: "POST", path: "/audit", body: b });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  // SOURCE CONTROL (Enterprise)
  server.tool("n8n_source_control_pull", "Pull workflows from connected Git repository. Enterprise feature.", {
    force: z.boolean().default(false).describe("Force pull (overwrites local changes)")
  }, async (p) => {
    const r = await n8nRequest({ method: "POST", path: "/source-control/pull", body: { force: p.force } });
    return { content: [{ type: "text", text: formatResponse(r.data) }] };
  });

  return server;
}

// SSE SERVER
const app = express();
const sessions = new Map<string, { transport: SSEServerTransport; server: McpServer }>();

app.use((req, res, next) => {
  if (req.path === "/messages") return next();
  express.json()(req, res, next);
});

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
  res.json({ status: "ok", server: "n8n-mcp-server", version: "2.0.0", sessions: sessions.size, n8nConfigured: !!(process.env.N8N_API_KEY && process.env.N8N_BASE_URL) });
});

const PORT = parseInt(process.env.PORT || "3000");
app.listen(PORT, () => {
  console.log(`n8n MCP server v2.0.0 listening on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`N8N_BASE_URL: ${process.env.N8N_BASE_URL || "(not set)"}`);
  console.log(`N8N_API_KEY: ${process.env.N8N_API_KEY ? "configured" : "NOT SET"}`);
});
