---
name: Multitenancy
description: Multi-tenancy reference for DaaS applications — see manage-scope skill and its references for the complete guide.
applyTo: "**/*.{ts,tsx,sql}"
---

# Multitenancy

Multi-tenancy in DaaS is implemented using the native scope system.

On an Engine project the project is one tenant. Every scope hierarchy begins below the project's tenant node: create no scope type without a parent and no scope item without a parent. Scope types, items and collection settings are managed through `/api/scope/types`, `/api/scope/items` and `/api/scope/collection-config` with an administrator's session; the MCP `scope` tool, served to an administrator only, assigns a role to a user at a scope (`assign_user_role`) and registers a collection as tenanted (`create_config`, the body of `POST /api/scope/collection-config`). On an Engine project a scoped collection's scope column is a many-to-one field to `daas_scope_items` (`meta.options.related_collection: daas_scope_items`, `meta.options.related_field: uri_path`), which gives it a foreign key to `daas_scope_items(uri_path)`.

See the `/manage-scope` skill; its `SKILL.md` names the references for each kind of project. On a Supabase project they are:
- `manage-scope/references/scope-management.instructions.md` — MCP setup, scope types, items, collection config
- `manage-scope/references/scope-permissions.instructions.md` — permission inheritance, enforcement internals
- `manage-scope/references/scope-client.instructions.md` — ScopeProvider, API requests, 400/403 handling, onboarding flow