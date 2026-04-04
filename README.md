# n8n MCP Server

MCP (Model Context Protocol) server for [n8n](https://n8n.io/) workflow automation. Gives Claude direct access to manage workflows, executions, credentials, tags, variables, users, and security audits via the n8n REST API.

## Tools (27 total)

### Workflows
- `n8n_list_workflows` - List/filter/paginate workflows
- `n8n_get_workflow` - Get full workflow definition by ID
- `n8n_create_workflow` - Create a new workflow
- `n8n_update_workflow` - Update an existing workflow
- `n8n_delete_workflow` - Delete a workflow
- `n8n_activate_workflow` - Activate (publish) a workflow
- `n8n_deactivate_workflow` - Deactivate a workflow
- `n8n_get_workflow_tags` - Get tags for a workflow
- `n8n_update_workflow_tags` - Set tags on a workflow

### Executions
- `n8n_list_executions` - List/filter executions (status, workflow)
- `n8n_get_execution` - Get execution details with data
- `n8n_delete_execution` - Delete execution history
- `n8n_retry_execution` - Retry a failed execution

### Credentials
- `n8n_list_credentials` - List all credentials (metadata only)
- `n8n_create_credential` - Create a new credential
- `n8n_delete_credential` - Delete a credential
- `n8n_get_credential_schema` - Get schema for a credential type

### Tags
- `n8n_list_tags` - List all tags
- `n8n_create_tag` - Create a tag
- `n8n_update_tag` - Rename a tag
- `n8n_delete_tag` - Delete a tag

### Variables
- `n8n_list_variables` - List all variables
- `n8n_create_variable` - Create a variable
- `n8n_delete_variable` - Delete a variable

### Users
- `n8n_list_users` - List all users (owner only)
- `n8n_get_user` - Get user by ID or email

### Admin
- `n8n_run_audit` - Run security audit
- `n8n_source_control_pull` - Pull from Git (enterprise)

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `N8N_BASE_URL` | Yes | Your n8n instance URL (e.g. `https://your-instance.app.n8n.cloud`) |
| `N8N_API_KEY` | Yes | API key from n8n Settings > API |
| `PORT` | No | Server port (default: 3000) |

## Setup

```bash
npm install
npm run build
npm start
```

## Deploy on Railway

1. Push to GitHub
2. Create Railway project from repo
3. Set `N8N_BASE_URL` and `N8N_API_KEY` environment variables
4. Deploy - SSE endpoint will be at `https://<service>.up.railway.app/sse`

## Connect to Claude.ai

Add as a custom MCP connector with the SSE endpoint URL.
