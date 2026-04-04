import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { z } from "zod";
import { n8nRequest, formatResponse } from "./api-client.js";

const server = new McpServer({
  name: "n8n-mcp-server",
  version: "1.0.0",
});

// ============================================================
// WORKFLOW TOOLS
// ============================================================

server.tool(
  "n8n_list_workflows",
  "List all workflows in the n8n instance. Supports filtering by tags and status, with cursor-based pagination.",
  {
    limit: z.number().int().min(1).max(250).default(20).describe("Max workflows to return (1-250)"),
    cursor: z.string().optional().describe("Pagination cursor from previous response"),
    tags: z.string().optional().describe("Comma-separated tag names to filter by"),
    name: z.string().optional().describe("Filter workflows by name (partial match)"),
    active: z.boolean().optional().describe("Filter by active/inactive status"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "GET",
      path: "/workflows",
      query: {
        limit: params.limit,
        cursor: params.cursor,
        tags: params.tags,
        name: params.name,
        active: params.active,
      },
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

server.tool(
  "n8n_get_workflow",
  "Get a single workflow by ID, including its full node/connection definition.",
  {
    workflowId: z.string().describe("The workflow ID"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "GET",
      path: `/workflows/${params.workflowId}`,
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

server.tool(
  "n8n_create_workflow",
  "Create a new workflow in n8n. Provide the workflow definition as a JSON object with name and nodes.",
  {
    name: z.string().describe("Name for the new workflow"),
    nodes: z.array(z.record(z.unknown())).describe("Array of node objects defining the workflow"),
    connections: z.record(z.unknown()).optional().describe("Connections between nodes"),
    settings: z.record(z.unknown()).optional().describe("Workflow settings (e.g. timezone, saveManualExecutions)"),
    staticData: z.union([z.string(), z.record(z.unknown())]).optional().describe("Static data for the workflow"),
  },
  async (params) => {
    const body: Record<string, unknown> = {
      name: params.name,
      nodes: params.nodes,
    };
    if (params.connections) body.connections = params.connections;
    if (params.settings) body.settings = params.settings;
    if (params.staticData) body.staticData = params.staticData;

    const res = await n8nRequest({
      method: "POST",
      path: "/workflows",
      body,
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

server.tool(
  "n8n_update_workflow",
  "Update an existing workflow. If the workflow is active, the updated version is automatically re-published.",
  {
    workflowId: z.string().describe("The workflow ID to update"),
    name: z.string().optional().describe("New name for the workflow"),
    nodes: z.array(z.record(z.unknown())).optional().describe("Updated array of node objects"),
    connections: z.record(z.unknown()).optional().describe("Updated connections between nodes"),
    settings: z.record(z.unknown()).optional().describe("Updated workflow settings"),
  },
  async (params) => {
    const body: Record<string, unknown> = {};
    if (params.name) body.name = params.name;
    if (params.nodes) body.nodes = params.nodes;
    if (params.connections) body.connections = params.connections;
    if (params.settings) body.settings = params.settings;

    const res = await n8nRequest({
      method: "PUT",
      path: `/workflows/${params.workflowId}`,
      body,
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

server.tool(
  "n8n_delete_workflow",
  "Delete a workflow by ID. This permanently removes the workflow and its execution history.",
  {
    workflowId: z.string().describe("The workflow ID to delete"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "DELETE",
      path: `/workflows/${params.workflowId}`,
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

server.tool(
  "n8n_activate_workflow",
  "Activate (publish) a workflow so it starts running on its triggers.",
  {
    workflowId: z.string().describe("The workflow ID to activate"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "POST",
      path: `/workflows/${params.workflowId}/activate`,
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

server.tool(
  "n8n_deactivate_workflow",
  "Deactivate (unpublish) a workflow so it stops running on triggers.",
  {
    workflowId: z.string().describe("The workflow ID to deactivate"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "POST",
      path: `/workflows/${params.workflowId}/deactivate`,
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

server.tool(
  "n8n_get_workflow_tags",
  "Get all tags associated with a specific workflow.",
  {
    workflowId: z.string().describe("The workflow ID"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "GET",
      path: `/workflows/${params.workflowId}/tags`,
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

server.tool(
  "n8n_update_workflow_tags",
  "Update the tags associated with a workflow. Replaces all existing tag associations.",
  {
    workflowId: z.string().describe("The workflow ID"),
    tagIds: z.array(z.object({ id: z.string() })).describe("Array of tag objects with 'id' field to associate"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "PUT",
      path: `/workflows/${params.workflowId}/tags`,
      body: params.tagIds,
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

// ============================================================
// EXECUTION TOOLS
// ============================================================

server.tool(
  "n8n_list_executions",
  "List workflow executions with filtering and pagination. Use to monitor workflow runs and find failures.",
  {
    limit: z.number().int().min(1).max(250).default(20).describe("Max executions to return"),
    cursor: z.string().optional().describe("Pagination cursor"),
    workflowId: z.string().optional().describe("Filter by workflow ID"),
    status: z.enum(["error", "success", "waiting"]).optional().describe("Filter by execution status"),
    includeData: z.boolean().optional().describe("Include full execution data in response"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "GET",
      path: "/executions",
      query: {
        limit: params.limit,
        cursor: params.cursor,
        workflowId: params.workflowId,
        status: params.status,
        includeData: params.includeData,
      },
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

server.tool(
  "n8n_get_execution",
  "Get details of a specific execution by ID, including full execution data.",
  {
    executionId: z.string().describe("The execution ID"),
    includeData: z.boolean().default(true).describe("Include full execution data"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "GET",
      path: `/executions/${params.executionId}`,
      query: { includeData: params.includeData },
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

server.tool(
  "n8n_delete_execution",
  "Delete a specific execution by ID. Removes execution history and associated data.",
  {
    executionId: z.string().describe("The execution ID to delete"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "DELETE",
      path: `/executions/${params.executionId}`,
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

server.tool(
  "n8n_retry_execution",
  "Retry a failed or stopped execution. Can use either the original or latest workflow version.",
  {
    executionId: z.string().describe("The execution ID to retry"),
    loadWorkflow: z.boolean().default(false).describe("If true, retries with the latest workflow version instead of the snapshot from the original execution"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "POST",
      path: `/executions/${params.executionId}/retry`,
      body: { loadWorkflow: params.loadWorkflow },
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

// ============================================================
// CREDENTIAL TOOLS
// ============================================================

server.tool(
  "n8n_list_credentials",
  "List all credentials in the n8n instance. Returns metadata only, not credential secrets.",
  {
    limit: z.number().int().min(1).max(250).default(20).describe("Max credentials to return"),
    cursor: z.string().optional().describe("Pagination cursor"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "GET",
      path: "/credentials",
      query: { limit: params.limit, cursor: params.cursor },
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

server.tool(
  "n8n_create_credential",
  "Create a new credential in n8n. Provide the credential type and its data fields.",
  {
    name: z.string().describe("Display name for the credential"),
    type: z.string().describe("Credential type (e.g. 'slackApi', 'httpBasicAuth', 'githubApi')"),
    data: z.record(z.unknown()).describe("Credential data fields (specific to the credential type)"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "POST",
      path: "/credentials",
      body: {
        name: params.name,
        type: params.type,
        data: params.data,
      },
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

server.tool(
  "n8n_delete_credential",
  "Delete a credential by ID.",
  {
    credentialId: z.string().describe("The credential ID to delete"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "DELETE",
      path: `/credentials/${params.credentialId}`,
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

server.tool(
  "n8n_get_credential_schema",
  "Get the JSON schema for a credential type, showing required fields and their types.",
  {
    credentialTypeName: z.string().describe("The credential type name (e.g. 'slackApi', 'githubApi')"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "GET",
      path: `/credentials/schema/${params.credentialTypeName}`,
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

// ============================================================
// TAG TOOLS
// ============================================================

server.tool(
  "n8n_list_tags",
  "List all tags available in the n8n instance.",
  {
    limit: z.number().int().min(1).max(250).default(50).describe("Max tags to return"),
    cursor: z.string().optional().describe("Pagination cursor"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "GET",
      path: "/tags",
      query: { limit: params.limit, cursor: params.cursor },
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

server.tool(
  "n8n_create_tag",
  "Create a new tag for organizing workflows.",
  {
    name: z.string().describe("Tag name"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "POST",
      path: "/tags",
      body: { name: params.name },
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

server.tool(
  "n8n_update_tag",
  "Update an existing tag's name.",
  {
    tagId: z.string().describe("The tag ID to update"),
    name: z.string().describe("New tag name"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "PUT",
      path: `/tags/${params.tagId}`,
      body: { name: params.name },
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

server.tool(
  "n8n_delete_tag",
  "Delete a tag by ID.",
  {
    tagId: z.string().describe("The tag ID to delete"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "DELETE",
      path: `/tags/${params.tagId}`,
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

// ============================================================
// VARIABLE TOOLS
// ============================================================

server.tool(
  "n8n_list_variables",
  "List all variables. Variables store configuration values accessible across workflows.",
  {
    limit: z.number().int().min(1).max(250).default(50).describe("Max variables to return"),
    cursor: z.string().optional().describe("Pagination cursor"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "GET",
      path: "/variables",
      query: { limit: params.limit, cursor: params.cursor },
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

server.tool(
  "n8n_create_variable",
  "Create a new variable that can be accessed across all workflows.",
  {
    key: z.string().describe("Variable key/name"),
    value: z.string().describe("Variable value"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "POST",
      path: "/variables",
      body: { key: params.key, value: params.value },
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

server.tool(
  "n8n_delete_variable",
  "Delete a variable by ID.",
  {
    variableId: z.string().describe("The variable ID to delete"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "DELETE",
      path: `/variables/${params.variableId}`,
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

// ============================================================
// USER TOOLS
// ============================================================

server.tool(
  "n8n_list_users",
  "List all users in the n8n instance. Only available for instance owners.",
  {
    limit: z.number().int().min(1).max(250).default(20).describe("Max users to return"),
    cursor: z.string().optional().describe("Pagination cursor"),
    includeRole: z.boolean().default(true).describe("Include user roles in response"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "GET",
      path: "/users",
      query: {
        limit: params.limit,
        cursor: params.cursor,
        includeRole: params.includeRole,
      },
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

server.tool(
  "n8n_get_user",
  "Get a specific user by ID or email.",
  {
    userIdentifier: z.string().describe("User ID or email address"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "GET",
      path: `/users/${params.userIdentifier}`,
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

// ============================================================
// AUDIT TOOL
// ============================================================

server.tool(
  "n8n_run_audit",
  "Run a security audit on the n8n instance. Analyzes configuration for potential issues.",
  {
    categories: z.array(z.string()).optional().describe("Specific audit categories to check (e.g. 'credentials', 'database', 'nodes', 'filesystem', 'instance')"),
  },
  async (params) => {
    const body: Record<string, unknown> = {};
    if (params.categories) body.categories = params.categories;

    const res = await n8nRequest({
      method: "POST",
      path: "/audit",
      body,
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

// ============================================================
// SOURCE CONTROL TOOL
// ============================================================

server.tool(
  "n8n_source_control_pull",
  "Pull changes from the connected Git repository. Requires Source Control feature to be licensed and connected.",
  {
    force: z.boolean().default(false).describe("Force pull, overwriting local changes"),
  },
  async (params) => {
    const res = await n8nRequest({
      method: "POST",
      path: "/source-control/pull",
      body: { force: params.force },
    });
    return { content: [{ type: "text", text: formatResponse(res.data) }] };
  }
);

// ============================================================
// SSE SERVER TRANSPORT
// ============================================================

const app = express();

const sessions = new Map<string, SSEServerTransport>();

app.get("/sse", async (_req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  sessions.set(transport.sessionId, transport);

  res.on("close", () => {
    sessions.delete(transport.sessionId);
  });

  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = sessions.get(sessionId);

  if (!transport) {
    res.status(400).json({ error: "Unknown session" });
    return;
  }

  await transport.handlePostMessage(req, res);
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    server: "n8n-mcp-server",
    version: "1.0.0",
    sessions: sessions.size,
    n8nConfigured: !!process.env.N8N_API_KEY,
  });
});

const PORT = parseInt(process.env.PORT || "3000");
app.listen(PORT, () => {
  console.log(`n8n MCP server listening on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`N8N_BASE_URL: ${process.env.N8N_BASE_URL || "(not set - using http://localhost:5678)"}`);
  console.log(`N8N_API_KEY: ${process.env.N8N_API_KEY ? "configured" : "NOT SET"}`);
});
