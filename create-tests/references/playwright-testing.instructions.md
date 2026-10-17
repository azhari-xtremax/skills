---
applyTo: "**/*.{spec.ts,test.ts},**/app/**/*.{ts,tsx},**/api/**/*.ts"
---

# Playwright E2E Testing Standards

<!-- backend-gate:begin v1 -->
**Establish the backend first.** A Buildpad project's backend is either the Buildpad Engine or
Supabase, and some parts of this file hold for one of them only. Before you act on anything in
this file, find the backend with these steps, in order, and stop at the first step that answers:

1. Read `.buildpad/project.json` at the project root. If it is JSON and its field `backend` is
   `"engine"` or `"supabase"`, that is the backend. If `.buildpad/backend-answer.json` names the
   other backend, tell the developer the two files disagree, and follow `.buildpad/project.json`.
2. Otherwise read `.buildpad/backend-answer.json` in the same way; if its `backend` is
   `"engine"` or `"supabase"`, that is the backend.
3. If a folder named `supabase` at the project root holds a file named `config.toml`, or holds a
   folder named `migrations` that holds a file whose name ends in `.sql`, the backend is Supabase.
4. Otherwise ask the developer once: "Is this project's backend the Buildpad Engine or
   Supabase?" Write the answer to `.buildpad/backend-answer.json` as
   `{"buildpadBackendAnswer": 1, "backend": "engine"}` or
   `{"buildpadBackendAnswer": 1, "backend": "supabase"}`, and ask the developer to commit that
   file. Do not add it to `.gitignore`. Never write `.buildpad/project.json`.

To find the backend, do not open an environment file (`.env`, `.env.*`) or an MCP configuration
file, and do not call a tool that returns project credentials.

Then follow only the parts for that backend. A part starts at a line that holds only a comment
whose text is `buildpad` + `-backend: engine` or `buildpad` + `-backend: supabase`, and ends at the
next line that holds only a comment whose text is `/buildpad` + `-backend`. A comment that merely
mentions a backend is not a part. A file whose first line, after any front matter, holds only a
comment whose text is `buildpad` + `-backend-file: engine` (or `supabase`) holds for that backend
only, and so does every file in a folder named `engine-only` or `supabase-only`. Skip the other
backend's parts and copy no code from them; everything else holds for both. On an Engine project, when this file says that
something is not available, tell the developer so and stop: do not build a substitute.
<!-- backend-gate:end -->

All implementations, features, and refactors MUST include Playwright tests to ensure functional correctness. This document defines the testing strategy, patterns, and requirements.

## 🎯 Two-Tier Testing Strategy

Buildpad uses a **two-tier testing approach** for comprehensive validation:

### Tier 1: Storybook Component Tests (Isolated)

- **Purpose:** Fast, isolated component testing without authentication
- **Environment:** Storybook on `localhost:6006`
- **Auth Required:** No - uses mocked data
- **Best For:** Component development, interface testing, visual validation

```bash
# Start Storybook for VForm development
pnpm storybook:form

# Run Playwright against Storybook
pnpm test:storybook
```

**Test Files:**

- `tests/ui-form/vform-storybook.spec.ts` - VForm Storybook tests
- `packages/ui-form/src/VForm.stories.tsx` - Mocked data stories
- `packages/ui-form/src/VForm.daas.stories.tsx` - DaaS Playground (real API)

### Tier 2: DaaS E2E Tests (Integration)

- **Purpose:** Full integration testing with real API
- **Environment:** DaaS application
- **Auth Required:** Yes - uses admin user credentials
- **Best For:** Complete workflows, permissions, real data

```bash
# Run against hosted DaaS
pnpm test:e2e

# Interactive Playwright UI
pnpm test:e2e:ui
```

**Test Files:**

- `tests/ui-form/vform-daas.spec.ts` - DaaS integration tests
- `tests/ui-form/vform.spec.ts` - Complete E2E workflow tests
- `tests/auth.setup.ts` - Authentication setup

### DaaS Playground (Storybook with Real API)

The DaaS Playground story allows testing VForm with real DaaS credentials:

<!-- buildpad-backend: supabase -->
**Proxy Mode (Recommended - No CORS):**

```bash
# Start with environment variables for Vite proxy
STORYBOOK_DAAS_URL=https://xxx.buildpad-daas.xtremax.com \
STORYBOOK_DAAS_TOKEN=your-static-token \
pnpm storybook:form
```

**Direct Mode (Manual Entry):**

```bash
# Start Storybook without env vars
pnpm storybook:form
# Navigate to "Forms/VForm DaaS Playground"
# Enter DaaS URL and static token manually
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
**Proxy Mode (Recommended - No CORS):**

```bash
# Start with environment variables for Vite proxy
STORYBOOK_DAAS_URL=<Engine_URL> \
STORYBOOK_DAAS_TOKEN=<a test user's access token> \
pnpm storybook:form
```

**Direct Mode (Manual Entry):**

```bash
# Start Storybook without env vars
pnpm storybook:form
# Navigate to "Forms/VForm DaaS Playground"
# Enter the Engine_URL and a test user's access token manually
```

On an Engine project the token is a signed-in user's access token from a direct sign-in (`signIn` in Step 3 below), not a static token: the token in the project's MCP configuration is accepted only on `/api/mcp`, and the data API refuses it. The access token expires after one hour by default; sign in again then.
<!-- /buildpad-backend -->

## 🔴 CRITICAL: Test Requirements

**Implementation is NOT complete without corresponding tests!**

Every implementation MUST include:

1. **API Tests** - For all new/modified API routes
2. **Page Tests** - For all new/modified pages
3. **Component Tests** - For complex interactive components
4. **E2E Tests** - For complete user flows

## Test Directory Structure

```
tests/
├── auth.setup.ts                    # Global auth setup (runs once)
├── setup-test-users.ts              # Test user creation script
├── helpers/
│   ├── test-utils.ts               # Shared test utilities
│   ├── test-fixtures.ts            # Database fixtures
│   └── auth-tokens.ts              # Auth helpers
├── api/                            # API endpoint tests
│   └── [feature].spec.ts           # REST API tests
├── components/                     # Component integration tests
│   └── [component].spec.ts         # Interactive component tests
├── pages/                          # Page E2E tests
│   └── [page].spec.ts              # Page behavior tests
└── e2e/                            # End-to-end user flows
    └── [flow].spec.ts              # Complete user journeys
```

## Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

## Authentication Setup

Authentication is a critical component of E2E testing. The framework uses Playwright's storage state feature to create reusable auth states for different user types.

### Authentication Architecture

```
tests/
├── auth.setup.ts              # Creates auth state files (runs once before all tests)
├── setup-test-users.ts        # Creates test users in database (run manually)
├── helpers/
│   └── auth-tokens.ts         # Auth token helpers for API tests
└── playwright/
    └── .auth/                 # Generated auth state files (gitignored)
        ├── admin.json         # Admin user session
        ├── readonly.json      # Read-only user session
        ├── editor.json        # Editor user session
        └── [custom].json      # Custom test user sessions
```

### Step 1: Create Test Users Script

Create `tests/setup-test-users.ts` to provision test users with specific permissions:

<!-- buildpad-backend: supabase -->
```typescript
/**
 * Setup script to create test users with specific permissions
 * Run this before executing E2E tests
 *
 * Usage: pnpm tsx tests/setup-test-users.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing required environment variables:");
  console.error("- NEXT_PUBLIC_SUPABASE_URL");
  console.error("- SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Test role IDs - use constants for consistent test infrastructure
const ROLE_IDS = {
  readOnly: "11111111-1111-1111-1111-111111111111",
  editor: "22222222-2222-2222-2222-222222222222",
  creator: "33333333-3333-3333-3333-333333333333",
  noPermission: "44444444-4444-4444-4444-444444444444",
};

// Test users configuration
const TEST_USERS = [
  {
    email: "readonly@test.com",
    password: "Test123!@#",
    firstName: "Read",
    lastName: "Only",
    roleId: ROLE_IDS.readOnly,
  },
  {
    email: "editor@test.com",
    password: "Test123!@#",
    firstName: "Editor",
    lastName: "User",
    roleId: ROLE_IDS.editor,
  },
  {
    email: "creator@test.com",
    password: "Test123!@#",
    firstName: "Creator",
    lastName: "User",
    roleId: ROLE_IDS.creator,
  },
  {
    email: "noperm@test.com",
    password: "Test123!@#",
    firstName: "No",
    lastName: "Permission",
    roleId: ROLE_IDS.noPermission,
  },
];

async function createTestUser(config: (typeof TEST_USERS)[0]) {
  console.log(`\n📝 Creating user: ${config.email}`);

  try {
    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: config.email,
        password: config.password,
        email_confirm: true,
        user_metadata: {
          first_name: config.firstName,
          last_name: config.lastName,
        },
      });

    if (authError) {
      if (authError.message.includes("already registered")) {
        console.log(`  ⚠️  User already exists, updating...`);

        const { data: users } = await supabase.auth.admin.listUsers();
        const existingUser = users?.users?.find(
          (u) => u.email === config.email,
        );

        if (existingUser) {
          await supabase.auth.admin.updateUserById(existingUser.id, {
            password: config.password,
          });

          // Assign role via M2M junction table (daas_users.role column was removed)
          await supabase.from("daas_user_roles").upsert(
            { daas_users_id: existingUser.id, role_id: config.roleId },
            { onConflict: "daas_users_id,role_id" },
          );

          console.log(`  ✅ Updated existing user`);
          return;
        }
      }
      throw authError;
    }

    if (!authData?.user) {
      throw new Error("User creation failed");
    }

    const userId = authData.user.id;
    console.log(`  ✅ Created auth user: ${userId}`);

    // 2. Create/update daas_users record (role is assigned via junction table, not a column)
    const { error: updateError } = await supabase.from("daas_users").upsert({
      id: userId,
      email: config.email,
      first_name: config.firstName,
      last_name: config.lastName,
      status: "active",
    });

    if (updateError) {
      console.error(`  ❌ Error updating daas_users:`, updateError);
    } else {
      console.log(`  ✅ Created daas_users record`);
    }

    // 3. Assign role via daas_user_roles M2M junction table
    const { error: roleError } = await supabase.from("daas_user_roles").upsert(
      { daas_users_id: userId, role_id: config.roleId },
      { onConflict: "daas_users_id,role_id" },
    );

    if (roleError) {
      console.error(`  ❌ Error assigning role:`, roleError);
    } else {
      console.log(`  ✅ Assigned role via junction table`);
    }
  } catch (error) {
    console.error(`  ❌ Error creating user:`, error);
  }
}

async function main() {
  console.log("🚀 Setting up test users for E2E testing...\n");

  for (const user of TEST_USERS) {
    await createTestUser(user);
  }

  console.log("\n✨ Test user setup complete!\n");
  console.log("📋 Test user credentials:");
  TEST_USERS.forEach((user) => {
    console.log(`   ${user.email} / ${user.password}`);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
```typescript
/**
 * Setup script to create test roles and users with specific permissions
 * Run this before executing E2E tests, and again after adding a test user
 *
 * Usage: pnpm tsx tests/setup-test-users.ts
 */

import * as fs from "fs";
import * as path from "path";
import { engineRequest, signIn, TEST_USER_PASSWORD } from "./helpers/auth-tokens";

// The test administrator: an account an administrator created in the Studio's
// Users module, with a role whose policy has administrator access. Both values
// come from the pipeline's secrets (or .env.test.local, which is not committed).
const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  console.error("Missing required environment variables:");
  console.error("- TEST_ADMIN_EMAIL");
  console.error("- TEST_ADMIN_PASSWORD");
  process.exit(1);
}

// The collections the test roles may act on
const TEST_COLLECTIONS = ["[collection]"];

// Test roles, looked up by name. A role with actions gets one policy, attached
// to it, holding one permission per collection and action.
const TEST_ROLES = {
  basic: { name: "E2E Basic", actions: [] as string[] },
  readOnly: { name: "E2E Read Only", actions: ["read"] },
  editor: { name: "E2E Editor", actions: ["read", "update"] },
  creator: { name: "E2E Creator", actions: ["read", "create"] },
  noPermission: { name: "E2E No Permission", actions: [] as string[] },
};

// Test users configuration (the password is a fixed test value, not a secret)
const TEST_USERS = [
  { email: "e2e-basic-user@test.com", firstName: "Basic", lastName: "User", role: "basic" },
  { email: "e2e-readonly@test.com", firstName: "Read", lastName: "Only", role: "readOnly" },
  { email: "e2e-editor@test.com", firstName: "Editor", lastName: "User", role: "editor" },
  { email: "e2e-creator@test.com", firstName: "Creator", lastName: "User", role: "creator" },
  { email: "e2e-noperm@test.com", firstName: "No", lastName: "Permission", role: "noPermission" },
] as const;

function check(label: string, result: { status: number; body: unknown }, expected: number) {
  if (result.status !== expected) {
    throw new Error(`${label}: ${result.status} ${JSON.stringify(result.body)}`);
  }
}

async function findOrCreateRole(admin: string, config: { name: string; actions: string[] }) {
  const found = await engineRequest(admin, "GET", `/api/roles?search=${encodeURIComponent(config.name)}`);
  const existing = found.body?.data?.find((r: { name: string }) => r.name === config.name);
  if (existing) return existing.id as string;

  const role = await engineRequest(admin, "POST", "/api/roles", { name: config.name });
  check(`Create role ${config.name}`, role, 201);
  const roleId = role.body.data.id as string;

  if (config.actions.length > 0) {
    // A permission belongs to a policy, and a policy is attached to a role
    const policy = await engineRequest(admin, "POST", "/api/policies", { name: `${config.name} policy` });
    check(`Create policy for ${config.name}`, policy, 201);
    const policyId = policy.body.data.id as string;

    check(`Attach policy to ${config.name}`,
      await engineRequest(admin, "POST", "/api/access", { role: roleId, policy: policyId }), 201);

    for (const collection of TEST_COLLECTIONS) {
      for (const action of config.actions) {
        check(`Permission ${action} on ${collection}`,
          await engineRequest(admin, "POST", "/api/permissions", {
            policy: policyId,
            collection,
            action,
            fields: ["*"],
          }), 201);
      }
    }
  }

  console.log(`  ✅ Created role: ${config.name}`);
  return roleId;
}

async function findOrCreateUser(admin: string, config: (typeof TEST_USERS)[number], roleId: string) {
  console.log(`\n📝 User: ${config.email}`);

  // Look the user up first: every POST /api/users spends the account budget
  // (30 per caller per 10 minutes by default), a 409 for a taken address included.
  const found = await engineRequest(admin, "GET", `/api/users?search=${encodeURIComponent(config.email)}`);
  let user = found.body?.data?.find((u: { email: string }) => u.email === config.email);

  if (user) {
    console.log(`  ⚠️  User already exists`);
  } else {
    const created = await engineRequest(admin, "POST", "/api/users", {
      email: config.email,
      password: TEST_USER_PASSWORD,
      first_name: config.firstName,
      last_name: config.lastName,
      status: "active",
    });
    if (created.status === 429) {
      throw new Error("Account budget spent: wait as long as Retry-After says, then run again");
    }
    check(`Create user ${config.email}`, created, 201);
    user = created.body.data;
    console.log(`  ✅ Created user: ${user.id}`);
  }

  // Give the user a role in the project's tenant: without one, sign-in is refused
  const assigned = await engineRequest(admin, "POST", `/api/users/${user.id}/roles`, { role_id: roleId });
  if (assigned.status === 201) {
    console.log(`  ✅ Assigned role`);
  } else if (assigned.status === 409) {
    console.log(`  ⚠️  Role already assigned`);
  } else {
    console.error(`  ❌ Error assigning role: ${assigned.status}`, assigned.body);
  }
}

async function main() {
  console.log("🚀 Setting up test roles and users for E2E testing...\n");

  // A direct sign-in: it sends X-Tenant-Id (see tests/helpers/auth-tokens.ts)
  const admin = await signIn(adminEmail!, adminPassword!);

  const roleIds: Record<string, string> = {};
  for (const [key, role] of Object.entries(TEST_ROLES)) {
    roleIds[key] = await findOrCreateRole(admin, role);
  }

  // One after another, never in parallel
  for (const user of TEST_USERS) {
    await findOrCreateUser(admin, user, roleIds[user.role]);
  }

  // Access tokens for the API tests. They expire after one hour by default.
  const tokens = {
    TEST_ADMIN_TOKEN: admin,
    TEST_BASIC_USER_TOKEN: await signIn("e2e-basic-user@test.com", TEST_USER_PASSWORD),
    TEST_READONLY_USER_TOKEN: await signIn("e2e-readonly@test.com", TEST_USER_PASSWORD),
  };
  const tokensPath = path.join(process.cwd(), "playwright/.auth/tokens.json");
  const saved = fs.existsSync(tokensPath) ? JSON.parse(fs.readFileSync(tokensPath, "utf8")) : {};
  fs.mkdirSync(path.dirname(tokensPath), { recursive: true });
  fs.writeFileSync(tokensPath, JSON.stringify({ ...saved, ...tokens }, null, 2));

  console.log("\n✨ Test user setup complete!\n");
  console.log("📋 Test users:");
  TEST_USERS.forEach((user) => console.log(`   ${user.email}`));
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```
<!-- /buildpad-backend -->

### Step 2: Auth Setup File

Create `tests/auth.setup.ts` to generate auth state files:

<!-- buildpad-backend: supabase -->
```typescript
// tests/auth.setup.ts
import { test as setup, expect } from "@playwright/test";

/**
 * Global setup that runs before all tests.
 * Creates multiple authentication states for different user types.
 */

/**
 * Setup 1: Admin User
 * User whose policy grants admin_access = true
 */
setup("authenticate as admin", async ({ page }) => {
  const authFile = "playwright/.auth/admin.json";

  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");

  // Login as admin user
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("password");

  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/(users|policies|roles)/, { timeout: 10000 });
  await expect(
    page.locator('nav, [role="navigation"], h1, h2').first(),
  ).toBeVisible({ timeout: 5000 });

  // Save auth state
  await page.context().storageState({ path: authFile });
  console.log("✓ Admin authentication state saved");
});

/**
 * Setup 2: Read-Only User
 * User with read permissions only
 */
setup("authenticate as readonly user", async ({ page }) => {
  const authFile = "playwright/.auth/readonly.json";

  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Email").fill("readonly@test.com");
  await page.getByLabel("Password").fill("Test123!@#");

  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForFunction(
    () => !window.location.pathname.includes("/auth/login"),
    { timeout: 10000 },
  );
  await page.waitForLoadState("networkidle");

  await page.context().storageState({ path: authFile });
  console.log("✓ Read-only user authentication state saved");
});

/**
 * Setup 3: Editor User
 * User with read + update permissions
 * Note: Skipped if user doesn't exist
 */
setup.skip("authenticate as editor user", async ({ page }) => {
  const authFile = "playwright/.auth/editor.json";

  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Email").fill("editor@test.com");
  await page.getByLabel("Password").fill("Test123!@#");

  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/(users|policies|roles)/, { timeout: 10000 });

  await page.context().storageState({ path: authFile });
  console.log("✓ Editor user authentication state saved");
});

/**
 * Setup 4: Creator User
 * User with read + create permissions
 */
setup.skip("authenticate as creator user", async ({ page }) => {
  const authFile = "playwright/.auth/creator.json";

  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Email").fill("creator@test.com");
  await page.getByLabel("Password").fill("Test123!@#");

  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/(users|policies|roles)/, { timeout: 10000 });

  await page.context().storageState({ path: authFile });
  console.log("✓ Creator user authentication state saved");
});

/**
 * Setup 5: No Permission User
 * User with no permissions at all
 */
setup.skip("authenticate as no-permission user", async ({ page }) => {
  const authFile = "playwright/.auth/noperm.json";

  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Email").fill("noperm@test.com");
  await page.getByLabel("Password").fill("Test123!@#");

  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForFunction(
    () => !window.location.pathname.includes("/auth/login"),
    { timeout: 10000 },
  );

  await page.context().storageState({ path: authFile });
  console.log("✓ No-permission user authentication state saved");
});
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
```typescript
// tests/auth.setup.ts
import { test as setup } from "@playwright/test";
import { TEST_USER_PASSWORD } from "./helpers/auth-tokens";

/**
 * Global setup that runs before all tests.
 * Signs each test user in through the application's login page and saves
 * its storage state. The users exist already: tests/setup-test-users.ts
 * creates them through the Engine's API.
 */

// One after another: the Engine checks a limited number of passwords at a time
setup.describe.configure({ mode: "serial" });

const SESSIONS = [
  // The test administrator: email and password come from the pipeline's secrets
  {
    file: "playwright/.auth/admin.json",
    email: process.env.TEST_ADMIN_EMAIL ?? "",
    password: process.env.TEST_ADMIN_PASSWORD ?? "",
  },
  { file: "playwright/.auth/user.json", email: "e2e-basic-user@test.com", password: TEST_USER_PASSWORD },
  { file: "playwright/.auth/readonly.json", email: "e2e-readonly@test.com", password: TEST_USER_PASSWORD },
  { file: "playwright/.auth/editor.json", email: "e2e-editor@test.com", password: TEST_USER_PASSWORD },
  { file: "playwright/.auth/creator.json", email: "e2e-creator@test.com", password: TEST_USER_PASSWORD },
  { file: "playwright/.auth/noperm.json", email: "e2e-noperm@test.com", password: TEST_USER_PASSWORD },
];

for (const session of SESSIONS) {
  setup(`authenticate for ${session.file}`, async ({ page }) => {
    setup.skip(!session.email || !session.password, "TEST_ADMIN_EMAIL or TEST_ADMIN_PASSWORD is not set");

    await page.goto("/auth/login");
    await page.waitForLoadState("networkidle");

    // The application's own sign-in route names the tenant (X-Tenant-Id)
    await page.getByRole("textbox", { name: "Email" }).fill(session.email);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(session.password);
    await page.getByRole("button", { name: "Sign In" }).click();

    await page.waitForFunction(
      () => !window.location.pathname.includes("/auth/login"),
      { timeout: 10000 },
    );
    await page.waitForLoadState("networkidle");

    await page.context().storageState({ path: session.file });
    console.log(`✓ Authentication state saved: ${session.file}`);
  });
}
```
<!-- /buildpad-backend -->

### Step 3: Auth Token Helper

Create `tests/helpers/auth-tokens.ts` for API tests with bearer tokens:

<!-- buildpad-backend: supabase -->
```typescript
/**
 * Auth Token Helper for API Tests
 * Loads authentication tokens from environment or .env.test.local
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load .env.test.local if it exists
const envPath = path.join(process.cwd(), ".env.test.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

export const authTokens = {
  admin: process.env.TEST_ADMIN_TOKEN || "",
  limitedUser: process.env.TEST_LIMITED_USER_TOKEN || "",
  readonlyUser: process.env.TEST_READONLY_USER_TOKEN || "",
};

/**
 * Create request headers with auth token
 */
export function authHeaders(token: string): Record<string, string> {
  if (!token) {
    throw new Error("Auth token is undefined or empty");
  }
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Validate that all required tokens are available
 */
export function validateTokens(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!authTokens.admin) missing.push("TEST_ADMIN_TOKEN");

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get user ID from JWT token
 */
export function getUserIdFromToken(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString());
    return decoded.sub || null;
  } catch {
    return null;
  }
}
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
```typescript
/**
 * Auth Token Helper for API Tests
 * Signs users in directly against the Engine and loads the saved access tokens
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load .env.test.local if it exists
const envPath = path.join(process.cwd(), ".env.test.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// The Engine_URL and the project's tenant id, from the project's environment
export const engineUrl = (process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL ?? "").replace(/\/$/, "");
const tenantId = process.env.NEXT_PUBLIC_BUILDPAD_TENANT_ID ?? "";

// The fixed password tests/setup-test-users.ts gives every test user (a test value, not a secret)
export const TEST_USER_PASSWORD = "Test123!@#";

/**
 * Sign in directly and return the access token. A test runs in Node, not in a
 * browser, so it names the tenant itself: the header X-Tenant-Id, and `tenant`
 * in the body, which names the tenant the session acts in.
 */
export async function signIn(email: string, password: string): Promise<string> {
  const response = await fetch(`${engineUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": tenantId },
    body: JSON.stringify({ email, password, tenant: tenantId }),
  });
  if (!response.ok) {
    // 401: a wrong password, or an account with no role in the tenant; 503: try again shortly
    throw new Error(`Sign-in failed for ${email}: ${response.status} ${await response.text()}`);
  }
  const { data } = await response.json();
  return data.access_token;
}

/**
 * Call the Engine's API with a signed-in user's access token
 * (never with the token in the project's MCP configuration)
 */
export async function engineRequest(token: string, method: string, apiPath: string, body?: unknown) {
  const response = await fetch(`${engineUrl}${apiPath}`, {
    method,
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text(); // a delete answers 204 with no body
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

// Access tokens saved by tests/setup-test-users.ts and the custom setup scripts.
// They expire after one hour by default: run the setup again when tests fail with 401.
const tokensPath = path.join(process.cwd(), "playwright/.auth/tokens.json");
const saved: Record<string, string> = fs.existsSync(tokensPath)
  ? JSON.parse(fs.readFileSync(tokensPath, "utf8"))
  : {};

/**
 * A saved access token, by name (the environment wins over the saved file)
 */
export function savedToken(name: string): string {
  return process.env[name] || saved[name] || "";
}

export const authTokens = {
  admin: savedToken("TEST_ADMIN_TOKEN"),
  basicUser: savedToken("TEST_BASIC_USER_TOKEN"),
  limitedUser: savedToken("TEST_LIMITED_USER_TOKEN"),
  readonlyUser: savedToken("TEST_READONLY_USER_TOKEN"),
};

/**
 * Create request headers with auth token
 */
export function authHeaders(token: string): Record<string, string> {
  if (!token) {
    throw new Error("Auth token is undefined or empty");
  }
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Validate that all required tokens are available
 */
export function validateTokens(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!authTokens.admin) missing.push("TEST_ADMIN_TOKEN");

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get user ID from JWT token
 */
export function getUserIdFromToken(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString());
    return decoded.user_id || decoded.sub || null;
  } catch {
    return null;
  }
}
```

On an Engine project an API test that calls the Engine itself sends one of these tokens to `${engineUrl}/api/...`. A test that calls the application's own routes (`/api/...` on `localhost:3000`) sends a token only to a route that reads the `Authorization` header. A route the Buildpad CLI generates reads the session the application's sign-in stored instead, and forwards its access token to the Engine: test such a route with a storage state (Step 4).
<!-- /buildpad-backend -->

### Step 4: Using Auth States in Tests

#### Using Storage State in Tests

```typescript
// tests/e2e/admin-features.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Admin Features", () => {
  // Use admin auth state for all tests in this describe block
  test.use({ storageState: "playwright/.auth/admin.json" });

  test("should show admin navigation", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
  });

  test("should access admin-only page", async ({ page }) => {
    await page.goto("/settings/ai");
    await expect(
      page.locator("h1, h2").filter({ hasText: "Settings" }),
    ).toBeVisible();
  });
});

test.describe("Non-Admin Access", () => {
  // Use readonly auth state for all tests in this describe block
  test.use({ storageState: "playwright/.auth/readonly.json" });

  test("should not show admin-only features", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator('a[href="/settings/ai"]')).not.toBeVisible();
  });

  test("should redirect from admin pages", async ({ page }) => {
    await page.goto("/settings/ai");
    await page.waitForLoadState("networkidle");

    // Should redirect or show 403
    expect(page.url()).not.toContain("/settings");
  });
});
```

#### Using Tokens in API Tests

```typescript
// tests/api/protected-endpoint.spec.ts
import { test, expect } from "@playwright/test";
import { authHeaders, authTokens } from "../helpers/auth-tokens";

test.describe("Protected API Endpoints", () => {
  test("should return 401 without auth", async ({ request }) => {
    const response = await request.get("/api/protected");
    expect(response.status()).toBe(401);
  });

  test("should return 200 with valid token", async ({ request }) => {
    const response = await request.get("/api/protected", {
      headers: authHeaders(authTokens.admin),
    });
    expect(response.status()).toBe(200);
  });

  test("should return 403 for unauthorized user", async ({ request }) => {
    const response = await request.delete("/api/admin-only", {
      headers: authHeaders(authTokens.readonlyUser),
    });
    expect(response.status()).toBe(403);
  });
});
```

### Setup Commands

```bash
# 1. Create test users in database (one-time)
pnpm tsx tests/setup-test-users.ts

# 2. Generate auth states (runs automatically with tests)
pnpm exec playwright test --project=setup

# 3. Verify auth files exist
ls -la playwright/.auth/
# Expected: admin.json, readonly.json, etc.
```

### Gitignore Auth Files

Add to `.gitignore`:

```gitignore
# Playwright auth states (contain session tokens)
playwright/.auth/
```

### Creating Custom Auth States for Specific Tests

For tests requiring specific permissions (e.g., item-level filtering):

```typescript
// tests/auth-custom.setup.ts
import { test as setup } from "@playwright/test";

setup("authenticate as user with status filter", async ({ page }) => {
  const authFile = "playwright/.auth/user-with-status-filter.json";

  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Email").fill("filter-user@example.com");
  await page.getByLabel("Password").fill("Test123!@#");
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.waitForFunction(
    () => !window.location.pathname.includes("/auth/login"),
    { timeout: 10000 },
  );
  await page.context().storageState({ path: authFile });
});

setup("authenticate as user with self access", async ({ page }) => {
  const authFile = "playwright/.auth/user-with-self-access.json";

  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Email").fill("self-access@example.com");
  await page.getByLabel("Password").fill("Test123!@#");
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.waitForFunction(
    () => !window.location.pathname.includes("/auth/login"),
    { timeout: 10000 },
  );
  await page.context().storageState({ path: authFile });
});
```

### Auth State Reference

| Auth File          | User Type     | Permissions      | Use Case             |
| ------------------ | ------------- | ---------------- | -------------------- |
| `admin.json`       | Admin         | Full access      | Admin feature tests  |
| `readonly.json`    | Read-only     | Read only        | View-only tests      |
| `editor.json`      | Editor        | Read + Update    | Edit tests           |
| `creator.json`     | Creator       | Read + Create    | Create tests         |
| `noperm.json`      | No permission | None             | Access denied tests  |
| `user-with-*.json` | Custom        | Specific filters | RLS/permission tests |

## Test Utilities

Create reusable helpers in `tests/helpers/test-utils.ts`:

```typescript
import { Page, expect, APIRequestContext } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

/**
 * Generic API request helper
 */
async function apiRequest(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  data?: unknown,
  requestContext?: APIRequestContext,
) {
  if (requestContext) {
    let response;
    switch (method) {
      case "GET":
        response = await requestContext.get(path);
        break;
      case "POST":
        response = await requestContext.post(path, { data });
        break;
      case "PATCH":
        response = await requestContext.patch(path, { data });
        break;
      case "DELETE":
        response = await requestContext.delete(path);
        break;
    }
    return {
      ok: response.ok(),
      status: response.status(),
      json: () => response.json(),
      text: () => response.text(),
    };
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });

  return {
    ok: response.ok,
    status: response.status,
    json: () => response.json(),
    text: () => response.text(),
  };
}

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState("networkidle");
}

/**
 * Login helper
 */
export async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/(users|roles|policies)/, { timeout: 10000 });
}

/**
 * Create test data via API
 */
export async function createTestDataViaAPI(
  endpoint: string,
  data: Record<string, unknown>,
  request?: APIRequestContext,
) {
  const response = await apiRequest("POST", endpoint, data, request);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create test data: ${response.status}. ${errorText}`,
    );
  }

  const result = (await response.json()) as { data?: unknown };
  if (!result || !result.data) {
    throw new Error(`Invalid response: ${JSON.stringify(result)}`);
  }

  return result.data;
}

/**
 * Delete test data via API
 */
export async function deleteTestDataViaAPI(
  endpoint: string,
  request?: APIRequestContext,
) {
  await apiRequest("DELETE", endpoint, undefined, request);
}

/**
 * Wait for notification
 */
export async function waitForNotification(page: Page, message?: string) {
  if (message) {
    await expect(
      page.locator(".mantine-Notification-root").filter({ hasText: message }),
    ).toBeVisible();
  } else {
    await expect(
      page.locator(".mantine-Notification-root").first(),
    ).toBeVisible();
  }
}
```

## API Test Patterns

### Basic CRUD API Test

<!-- buildpad-backend: supabase -->
```typescript
// tests/api/[feature].spec.ts
import { test, expect } from "@playwright/test";
import {
  createTestDataViaAPI,
  deleteTestDataViaAPI,
} from "../helpers/test-utils";

test.describe("[Feature] API", () => {
  let createdIds: string[] = [];

  test.afterEach(async () => {
    // Cleanup all created items
    for (const id of createdIds) {
      await deleteTestDataViaAPI(`/api/[feature]/${id}`);
    }
    createdIds = [];
  });

  test.describe("GET /api/[feature]", () => {
    test("should return all items", async ({ request }) => {
      // Create test data
      const item = await createTestDataViaAPI("/api/[feature]", {
        name: "Test Item",
      });
      createdIds.push(item.id);

      const response = await request.get("http://localhost:3000/api/[feature]");
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBeTruthy();
    });

    test("should support search parameter", async ({ request }) => {
      const item = await createTestDataViaAPI("/api/[feature]", {
        name: "Unique Search Term XYZ",
      });
      createdIds.push(item.id);

      const response = await request.get(
        "http://localhost:3000/api/[feature]?search=Unique",
      );
      expect(response.status()).toBe(200);

      const data = await response.json();
      const found = data.data.some((r: { name: string }) =>
        r.name.includes("Unique"),
      );
      expect(found).toBeTruthy();
    });
  });

  test.describe("GET /api/[feature]/[id]", () => {
    test("should return single item by ID", async ({ request }) => {
      const item = await createTestDataViaAPI("/api/[feature]", {
        name: "Single Item Test",
      });
      createdIds.push(item.id);

      const response = await request.get(
        `http://localhost:3000/api/[feature]/${item.id}`,
      );
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.data.id).toBe(item.id);
    });

    test("should return 404 for non-existent item", async ({ request }) => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await request.get(
        `http://localhost:3000/api/[feature]/${fakeId}`,
      );
      expect(response.status()).toBe(404);
    });
  });

  test.describe("POST /api/[feature]", () => {
    test("should create item with valid data", async ({ request }) => {
      const response = await request.post(
        "http://localhost:3000/api/[feature]",
        {
          data: {
            name: "Created via Test",
            description: "Test description",
          },
        },
      );

      expect(response.status()).toBe(201);

      const data = await response.json();
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toBe("Created via Test");

      createdIds.push(data.data.id);
    });

    test("should validate required fields", async ({ request }) => {
      const response = await request.post(
        "http://localhost:3000/api/[feature]",
        {
          data: {},
        },
      );

      expect(response.status()).toBe(400);
    });
  });

  test.describe("PATCH /api/[feature]/[id]", () => {
    test("should update existing item", async ({ request }) => {
      const item = await createTestDataViaAPI("/api/[feature]", {
        name: "Original Name",
      });
      createdIds.push(item.id);

      const response = await request.patch(
        `http://localhost:3000/api/[feature]/${item.id}`,
        {
          data: { name: "Updated Name" },
        },
      );

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.data.name).toBe("Updated Name");
    });
  });

  test.describe("DELETE /api/[feature]/[id]", () => {
    test("should delete item", async ({ request }) => {
      const item = await createTestDataViaAPI("/api/[feature]", {
        name: "To Be Deleted",
      });

      const response = await request.delete(
        `http://localhost:3000/api/[feature]/${item.id}`,
      );
      expect(response.status()).toBe(200);

      // Verify deleted
      const getResponse = await request.get(
        `http://localhost:3000/api/[feature]/${item.id}`,
      );
      expect(getResponse.status()).toBe(404);
    });
  });
});
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
On an Engine project `/api/items` answers a create with `200` and a delete with `204` and no body, and a route that passes the Engine's answer through answers the same. The test uses the administrator's storage state and passes `request` to the helpers, so they carry the session:

```typescript
// tests/api/[feature].spec.ts
import { test, expect } from "@playwright/test";
import {
  createTestDataViaAPI,
  deleteTestDataViaAPI,
} from "../helpers/test-utils";

test.describe("[Feature] API", () => {
  test.use({ storageState: "playwright/.auth/admin.json" });
  let createdIds: string[] = [];

  test.afterEach(async ({ request }) => {
    // Cleanup all created items
    for (const id of createdIds) {
      await deleteTestDataViaAPI(`/api/[feature]/${id}`, request);
    }
    createdIds = [];
  });

  test.describe("GET /api/[feature]", () => {
    test("should return all items", async ({ request }) => {
      // Create test data
      const item = await createTestDataViaAPI("/api/[feature]", {
        name: "Test Item",
      }, request);
      createdIds.push(item.id);

      const response = await request.get("http://localhost:3000/api/[feature]");
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBeTruthy();
    });

    test("should support search parameter", async ({ request }) => {
      const item = await createTestDataViaAPI("/api/[feature]", {
        name: "Unique Search Term XYZ",
      }, request);
      createdIds.push(item.id);

      const response = await request.get(
        "http://localhost:3000/api/[feature]?search=Unique",
      );
      expect(response.status()).toBe(200);

      const data = await response.json();
      const found = data.data.some((r: { name: string }) =>
        r.name.includes("Unique"),
      );
      expect(found).toBeTruthy();
    });
  });

  test.describe("GET /api/[feature]/[id]", () => {
    test("should return single item by ID", async ({ request }) => {
      const item = await createTestDataViaAPI("/api/[feature]", {
        name: "Single Item Test",
      }, request);
      createdIds.push(item.id);

      const response = await request.get(
        `http://localhost:3000/api/[feature]/${item.id}`,
      );
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.data.id).toBe(item.id);
    });

    test("should return 404 for non-existent item", async ({ request }) => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await request.get(
        `http://localhost:3000/api/[feature]/${fakeId}`,
      );
      expect(response.status()).toBe(404);
    });
  });

  test.describe("POST /api/[feature]", () => {
    test("should create item with valid data", async ({ request }) => {
      const response = await request.post(
        "http://localhost:3000/api/[feature]",
        {
          data: {
            name: "Created via Test",
            description: "Test description",
          },
        },
      );

      // The Engine answers a create on /api/items with 200
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toBe("Created via Test");

      createdIds.push(data.data.id);
    });

    test("should validate required fields", async ({ request }) => {
      const response = await request.post(
        "http://localhost:3000/api/[feature]",
        {
          data: {},
        },
      );

      expect(response.status()).toBe(400);
    });
  });

  test.describe("PATCH /api/[feature]/[id]", () => {
    test("should update existing item", async ({ request }) => {
      const item = await createTestDataViaAPI("/api/[feature]", {
        name: "Original Name",
      }, request);
      createdIds.push(item.id);

      const response = await request.patch(
        `http://localhost:3000/api/[feature]/${item.id}`,
        {
          data: { name: "Updated Name" },
        },
      );

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.data.name).toBe("Updated Name");
    });
  });

  test.describe("DELETE /api/[feature]/[id]", () => {
    test("should delete item", async ({ request }) => {
      const item = await createTestDataViaAPI("/api/[feature]", {
        name: "To Be Deleted",
      }, request);

      const response = await request.delete(
        `http://localhost:3000/api/[feature]/${item.id}`,
      );
      // The Engine answers a delete with 204 and no body
      expect(response.status()).toBe(204);

      // Verify deleted
      const getResponse = await request.get(
        `http://localhost:3000/api/[feature]/${item.id}`,
      );
      expect(getResponse.status()).toBe(404);
    });
  });
});
```
<!-- /buildpad-backend -->

## Page Test Patterns

### List Page Test

```typescript
// tests/pages/[feature].spec.ts
import { test, expect } from "@playwright/test";
import {
  waitForPageLoad,
  createTestDataViaAPI,
  deleteTestDataViaAPI,
} from "../helpers/test-utils";

test.describe("[Feature] Pages", () => {
  test.describe("/[feature] - List Page", () => {
    let testItemId: string;
    let uniqueName: string;

    test.beforeEach(async ({ page }) => {
      uniqueName = `E2E Test Item ${Date.now()}`;

      const item = await createTestDataViaAPI("/api/[feature]", {
        name: uniqueName,
        description: "Test item for E2E testing",
      });
      testItemId = item.id;

      await page.goto("/[feature]");
      await waitForPageLoad(page);

      await page
        .waitForSelector('[class*="LoadingOverlay"]', {
          state: "hidden",
          timeout: 10000,
        })
        .catch(() => {});
      await page.waitForSelector("table tbody", { timeout: 10000 });
    });

    test.afterEach(async () => {
      if (testItemId) {
        await deleteTestDataViaAPI(`/api/[feature]/${testItemId}`);
      }
    });

    test("should display list page", async ({ page }) => {
      await expect(
        page.locator("h2, h1").filter({ hasText: "[Feature]" }),
      ).toBeVisible();
    });

    test("should display table with headers", async ({ page }) => {
      const table = page.locator("table");
      await expect(table).toBeVisible();

      const headers = page.locator("thead th");
      expect(await headers.count()).toBeGreaterThan(0);
    });

    test("should have Add button", async ({ page }) => {
      const createButton = page.locator('button:has-text("Add")');
      await expect(createButton).toBeVisible();
    });

    test("should display existing items", async ({ page }) => {
      await expect(
        page.locator("tbody").filter({ hasText: uniqueName }),
      ).toBeVisible();
    });

    test("should navigate to detail when clicking row", async ({ page }) => {
      await page.waitForSelector("tbody tr", { timeout: 10000 });

      const testRow = page
        .locator("tbody tr")
        .filter({ hasText: uniqueName })
        .first();
      await testRow.click();

      await page.waitForURL(/\/\[feature\]\/[a-f0-9-]+/, { timeout: 5000 });
      expect(page.url()).toMatch(/\/\[feature\]\/[a-f0-9-]+/);
    });

    test("should filter when searching", async ({ page }) => {
      const searchInput = page
        .locator('input[type="search"], input[placeholder*="Search"]')
        .first();

      await searchInput.fill(uniqueName);
      await page.waitForTimeout(800); // Debounce

      const rows = page.locator("tbody tr");
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });
});
```

### Detail Page Test

```typescript
// tests/pages/[feature]-detail.spec.ts
import { test, expect } from "@playwright/test";
import {
  waitForPageLoad,
  createTestDataViaAPI,
  deleteTestDataViaAPI,
} from "../helpers/test-utils";

test.describe("[Feature] Detail Page", () => {
  let testItemId: string;

  test.beforeEach(async ({ page }) => {
    const item = await createTestDataViaAPI("/api/[feature]", {
      name: "Detail Test Item",
      description: "For detail page testing",
    });
    testItemId = item.id;

    await page.goto(`/[feature]/${testItemId}`);
    await waitForPageLoad(page);
  });

  test.afterEach(async () => {
    if (testItemId) {
      await deleteTestDataViaAPI(`/api/[feature]/${testItemId}`);
    }
  });

  test("should load item data", async ({ page }) => {
    await expect(page.locator('input[name="name"]')).toHaveValue(
      "Detail Test Item",
    );
  });

  test("should have save button", async ({ page }) => {
    const saveButton = page.locator('button:has-text("Save")');
    await expect(saveButton).toBeVisible();
  });

  test("should update item", async ({ page }) => {
    await page.fill('input[name="name"]', "Updated Name");
    await page.click('button:has-text("Save")');

    await expect(
      page.locator("text=Updated successfully, text=Saved"),
    ).toBeVisible({ timeout: 5000 });
  });

  test("should validate required fields", async ({ page }) => {
    await page.fill('input[name="name"]', "");
    await page.click('button:has-text("Save")');

    await expect(
      page.locator("text=/required|cannot be empty/i"),
    ).toBeVisible();
  });
});
```

## Component Test Patterns

### Modal Component Test

```typescript
// tests/components/[component]-modal.spec.ts
import { test, expect } from "@playwright/test";
import {
  waitForPageLoad,
  createTestDataViaAPI,
  deleteTestDataViaAPI,
} from "../helpers/test-utils";

test.describe("[Component] Modal", () => {
  let testItemId: string;

  test.beforeEach(async ({ page }) => {
    const item = await createTestDataViaAPI("/api/[feature]", {
      name: "Modal Test Item",
    });
    testItemId = item.id;

    await page.goto(`/[feature]/${testItemId}`);
    await waitForPageLoad(page);
  });

  test.afterEach(async () => {
    if (testItemId) {
      await deleteTestDataViaAPI(`/api/[feature]/${testItemId}`);
    }
  });

  test.describe("Modal Opening and Closing", () => {
    test("should open modal when clicking add button", async ({ page }) => {
      await page.click('button:has-text("Add")');

      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();
    });

    test("should close modal when clicking cancel", async ({ page }) => {
      await page.click('button:has-text("Add")');

      await page.click('[role="dialog"] button:has-text("Cancel")');

      const modal = page.locator('[role="dialog"]');
      await expect(modal).not.toBeVisible();
    });

    test("should close modal when clicking X button", async ({ page }) => {
      await page.click('button:has-text("Add")');

      const closeButton = page
        .locator('[role="dialog"] button[aria-label="Close"]')
        .first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await expect(page.locator('[role="dialog"]')).not.toBeVisible();
      }
    });
  });

  test.describe("Modal Form", () => {
    test("should submit form and close modal", async ({ page }) => {
      await page.click('button:has-text("Add")');

      await page.fill('[role="dialog"] input[name="field"]', "Test Value");
      await page.click('[role="dialog"] button:has-text("Save")');

      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });

    test("should validate required fields", async ({ page }) => {
      await page.click('button:has-text("Add")');
      await page.click('[role="dialog"] button:has-text("Save")');

      await expect(
        page.locator('[role="dialog"] text=/required/i'),
      ).toBeVisible();
    });
  });
});
```

## Role-Based Access Tests

### Admin vs Non-Admin Tests

```typescript
// tests/e2e/[feature]-access.spec.ts
import { test, expect } from "@playwright/test";

test.describe("[Feature] Access - Admin", () => {
  test.use({ storageState: "playwright/.auth/admin.json" });

  test("should show feature link in navigation", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const link = page.getByRole("link", { name: "[Feature]" });
    await expect(link).toBeVisible();
  });

  test("should allow access to feature page", async ({ page }) => {
    await page.goto("/[feature]");
    await expect(
      page.locator("h1, h2").filter({ hasText: "[Feature]" }),
    ).toBeVisible();
  });
});

test.describe("[Feature] Access - Non-Admin", () => {
  test.use({ storageState: "playwright/.auth/readonly.json" });

  test("should not show admin-only features", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const adminLink = page.locator('a[href="/admin-feature"]');
    await expect(adminLink).not.toBeVisible();
  });

  test("should redirect from protected pages", async ({ page }) => {
    await page.goto("/admin-feature");
    await page.waitForLoadState("networkidle");

    // Should redirect or show 403
    expect(page.url()).not.toContain("/admin-feature");
  });
});
```

## Best Practices

### 1. Always Clean Up Test Data

```typescript
test.afterEach(async () => {
  for (const id of createdIds) {
    await deleteTestDataViaAPI(`/api/[feature]/${id}`);
  }
  createdIds = [];
});
```

### 2. Use Data-TestId for Stable Selectors

```tsx
// In component
<button data-testid="add-item-btn">Add Item</button>;

// In test
await page.click('[data-testid="add-item-btn"]');
```

### 3. Wait for Network Stability

```typescript
await page.waitForLoadState("networkidle");
await page.waitForSelector("table tbody", { timeout: 10000 });
```

### 4. Use Descriptive Test Names

```typescript
test("should display validation error when name is empty", async ({ page }) => {
  // ...
});
```

### 5. Group Related Tests

```typescript
test.describe('[Feature] API', () => {
  test.describe('GET /api/[feature]', () => {
    test('should return all items', ...);
    test('should support pagination', ...);
  });

  test.describe('POST /api/[feature]', () => {
    test('should create with valid data', ...);
    test('should validate required fields', ...);
  });
});
```

### 6. Handle Async Operations

```typescript
await page.waitForResponse(
  (response) =>
    response.url().includes("/api/[feature]") && response.status() === 200,
);
```

## Test Commands

```bash
# Run all tests
pnpm test

# Run tests in UI mode (recommended for development)
pnpm test:ui

# Run tests in debug mode
pnpm test:debug

# Run specific test file
pnpm test tests/api/[feature].spec.ts

# Run tests matching a pattern
pnpm test --grep "should create"

# Run tests in headed mode
pnpm test:headed

# Run with specific browser
pnpm test --project=chromium
```

<!-- buildpad-backend: supabase -->
## Row-Level Security (RLS) Test Patterns

Every collection/endpoint MUST include RLS tests to verify security at both application and database layers.

### RLS Test Structure

```
tests/api/
├── rls-users.spec.ts          # Users API security
├── rls-roles.spec.ts          # Roles API security
├── rls-policies.spec.ts       # Policies API security
├── rls-permissions.spec.ts    # Permissions API security
├── rls-fields.spec.ts         # Fields API security
├── rls-relations.spec.ts      # Relations API security
├── rls-items.spec.ts          # Items API security
└── rls-database.spec.ts       # Database-level enforcement
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## Access Control Test Patterns

Every collection/endpoint MUST include access tests. On an Engine project access is roles, policies and permissions, which the Engine enforces on every request, and data is separated by scope inside the project's tenant (see the [create-rbac](../../create-rbac/SKILL.md) and [manage-scope](../../manage-scope/SKILL.md) skills). Test them through the API, with the test users of `tests/setup-test-users.ts`. There is no database policy to test, and no test reaches the database directly.

### Access Test Structure

```
tests/api/
├── access-users.spec.ts          # Users API access
├── access-roles.spec.ts          # Roles API access
├── access-policies.spec.ts       # Policies API access
├── access-permissions.spec.ts    # Permissions API access
├── access-fields.spec.ts         # Fields API access
├── access-relations.spec.ts      # Relations API access
├── access-items.spec.ts          # Items API access (row filters, field lists)
└── access-scope.spec.ts          # Scope separation inside the tenant
```

The test pattern below holds on an Engine project, with two readings: its names say RLS, and its self-access rule compares a field that holds a user's id (such as `id` on `daas_users`) with `$CURRENT_USER`, which is the signed-in user's id, not an email.
<!-- /buildpad-backend -->

### RLS Test Pattern

```typescript
import { test, expect } from "@playwright/test";

test.describe("[Collection] RLS Security", () => {
  // 1. Authentication — verify 401 for unauthenticated
  test("should return 401 without authentication", async ({ request }) => {
    const response = await request.get("/api/[collection]", {
      headers: { Authorization: "" },
    });
    expect(response.status()).toBe(401);
  });

  // 2. Admin bypass — verify admins see everything
  test.describe("Admin Access", () => {
    test.use({ storageState: "playwright/.auth/admin.json" });

    test("admin should access all resources", async ({ request }) => {
      const response = await request.get("/api/[collection]");
      expect(response.status()).toBe(200);
    });

    test("admin should perform all CRUD operations", async ({ request }) => {
      // POST, PATCH, DELETE all succeed
    });
  });

  // 3. Non-admin authorization — verify 403 for unauthorized ops
  test.describe("Non-Admin Access", () => {
    test.use({ storageState: "playwright/.auth/user.json" });

    test("should return 403 for admin-only operations", async ({ request }) => {
      const response = await request.delete("/api/[collection]/some-id");
      expect(response.status()).toBe(403);
    });

    test("should allow read when permission exists", async ({ request }) => {
      const response = await request.get("/api/[collection]");
      expect(response.status()).toBe(200);
    });
  });

  // 4. Self-access pattern
  test.describe("Self-Access", () => {
    test("user should only see own records with self-access filter", async ({ request }) => {
      // Use auth state with filter: { "email": { "_eq": "$CURRENT_USER" } }
      const response = await request.get("/api/users");
      const data = await response.json();
      expect(data.data.length).toBe(1); // Only own record
    });
  });

  // 5. Data isolation
  test("should not expose cross-user data", async ({ request }) => {
    // Verify user A cannot access user B's private records
  });

  // 6. SQL injection protection
  test("should reject SQL injection attempts", async ({ request }) => {
    const response = await request.get(
      "/api/[collection]?filter=" +
        encodeURIComponent('{"name":{"_eq":"\\'; DROP TABLE users;--"}}'),
    );
    expect(response.status()).not.toBe(500);
  });

  // 7. Performance
  test("should respond within 2 seconds", async ({ request }) => {
    const start = Date.now();
    await request.get("/api/[collection]");
    expect(Date.now() - start).toBeLessThan(2000);
  });
});
```

### Security Layers to Test

<!-- buildpad-backend: supabase -->
| Layer          | What to Verify                      | Expected Error      |
| -------------- | ----------------------------------- | ------------------- |
| Authentication | No token / invalid token            | 401                 |
| Authorization  | Missing permission for action       | 403                 |
| Admin Bypass   | Admin can access all resources      | 200                 |
| Self-Access    | User sees only own records          | 200 (filtered)      |
| Database RLS   | PostgreSQL policies enforced        | Filtered results    |
| Audit Logging  | Operations logged to activity table | Log entry exists    |
| Data Isolation | Cross-user access prevented         | 404 or filtered out |

<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
| Layer           | What to Verify                                         | Expected Error                                          |
| --------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| Authentication  | No token / invalid token / expired token               | 401 (`UNAUTHENTICATED`, `TOKEN_INVALID`, `TOKEN_EXPIRED`) |
| Authorization   | Missing permission for action                          | 403 (`FORBIDDEN`)                                       |
| Admin Bypass    | Admin can access all resources                         | 200                                                     |
| Self-Access     | User sees only own records                             | 200 (filtered)                                          |
| Row filters     | A permission's filter applied to every read and write  | Filtered results                                        |
| Field lists     | A write naming a field outside the permission's fields | 403 (`FORBIDDEN`), the message names the fields         |
| Scope           | A scope asserted outside the tenant (`X-Resource-Uri`) | 403 (`FORBIDDEN_SCOPE`)                                 |
| Audit Logging   | Operations logged to activity table                    | Log entry exists                                        |
| Data Isolation  | Cross-user access prevented                            | 404 or filtered out                                     |

<!-- /buildpad-backend -->
<!-- buildpad-backend: supabase -->
## Item-Level Filtering Test Patterns

Test that permission filters correctly restrict data access.

### Test Structure

```
tests/api/item-level-filtering/
├── filter-operators.spec.ts     # Basic filter operators (_eq, _neq, _in, etc.)
├── dynamic-values.spec.ts       # Dynamic values ($CURRENT_USER, $CURRENT_ROLE)
├── filter-logic.spec.ts         # Complex OR/AND logic, nested conditions
└── admin-bypass.spec.ts         # Admin bypass verification
```

### Filter Test Pattern

```typescript
test.describe("Item-Level Filtering", () => {
  // Status filtering: { "status": { "_eq": "active" } }
  test("user with status filter sees only active items", async ({
    request,
  }) => {
    // Use auth state for user with status filter permission
    const response = await request.get("/api/users");
    const data = await response.json();
    data.data.forEach((user: any) => expect(user.status).toBe("active"));
  });

  // Self-access: { "email": { "_eq": "$CURRENT_USER" } }
  test("user with self-access sees only own record", async ({ request }) => {
    // Use auth state for user with self-access permission
    const response = await request.get("/api/users");
    const data = await response.json();
    expect(data.data.length).toBe(1);
    expect(data.data[0].email).toBe("self-access@example.com");
  });

  // Multiple permissions (OR logic)
  test("multiple permissions combine with OR", async ({ request }) => {
    // Permission 1: { "status": { "_eq": "active" } }
    // Permission 2: { "status": { "_eq": "invited" } }
    // → User sees active OR invited
    const response = await request.get("/api/users");
    const data = await response.json();
    data.data.forEach((user: any) => {
      expect(["active", "invited"]).toContain(user.status);
    });
  });

  // Filters work with other parameters
  test("filter + search works correctly", async ({ request }) => {
    const response = await request.get("/api/users?search=keyword");
    expect(response.status()).toBe(200);
  });

  test("filter + pagination works correctly", async ({ request }) => {
    const response = await request.get("/api/users?limit=5&offset=0");
    expect(response.status()).toBe(200);
  });
});
```

### Setup Script Pattern

Create test users with specific filter permissions via a setup script:

```javascript
// scripts/setup-filter-tests.mjs
// Creates:
// - Test roles with specific filter patterns
// - Test users assigned to those roles
// - Test policies with filter JSON (status, self-access, role-based)
// - Test permissions linking policies to collections
```

<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## Item-Level Filtering Test Patterns

Test that permission filters correctly restrict data access. On an Engine project a permission's filter (`permissions`) limits the rows of every read and write, and the filters of several matching rules combine with OR. A policy holds one rule per collection and action: give a second filter its own policy. The Engine resolves the dynamic values `$CURRENT_USER` (the user's id), `$CURRENT_USER.<field>`, `$CURRENT_ROLE` and `$NOW`. It does not resolve `$CURRENT_ROLES`, `$CURRENT_POLICIES`, `$CURRENT_ROLE.<field>` or an adjusted `$NOW`: a request that reaches a rule using one is refused, so test that no rule uses one.

### Test Structure

```
tests/api/item-level-filtering/
├── filter-operators.spec.ts     # Basic filter operators (_eq, _neq, _in, etc.)
├── dynamic-values.spec.ts       # Dynamic values ($CURRENT_USER, $CURRENT_ROLE)
├── filter-logic.spec.ts         # Complex OR/AND logic, nested conditions
└── admin-bypass.spec.ts         # Admin bypass verification
```

### Filter Test Pattern

These tests call the Engine's API directly, with the access tokens the setup script saved:

```typescript
import { test, expect } from "@playwright/test";
import {
  authHeaders,
  authTokens,
  engineUrl,
  getUserIdFromToken,
  savedToken,
} from "../helpers/auth-tokens";

const items = `${engineUrl}/api/items/[collection]`;

test.describe("Item-Level Filtering", () => {
  // Status filtering: { "status": { "_eq": "active" } }
  test("user with status filter sees only active items", async ({
    request,
  }) => {
    const response = await request.get(items, {
      headers: authHeaders(savedToken("TEST_STATUS_FILTER_TOKEN")),
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    data.data.forEach((item: any) => expect(item.status).toBe("active"));
  });

  // Self-access: { "user_created": { "_eq": "$CURRENT_USER" } }
  test("user with self-access sees only own items", async ({ request }) => {
    const token = savedToken("TEST_SELF_ACCESS_TOKEN");
    const response = await request.get(items, { headers: authHeaders(token) });
    const data = await response.json();
    data.data.forEach((item: any) =>
      expect(item.user_created).toBe(getUserIdFromToken(token)),
    );
  });

  // Two policies, one rule each (OR logic)
  test("filters of two policies combine with OR", async ({ request }) => {
    // Policy 1: { "status": { "_eq": "active" } }
    // Policy 2: { "status": { "_eq": "invited" } }
    // → User sees active OR invited
    const response = await request.get(items, {
      headers: authHeaders(savedToken("TEST_TWO_POLICIES_TOKEN")),
    });
    const data = await response.json();
    data.data.forEach((item: any) => {
      expect(["active", "invited"]).toContain(item.status);
    });
  });

  // Filters work with other parameters
  test("filter + search works correctly", async ({ request }) => {
    const response = await request.get(`${items}?search=keyword`, {
      headers: authHeaders(savedToken("TEST_STATUS_FILTER_TOKEN")),
    });
    expect(response.status()).toBe(200);
  });

  test("filter + pagination works correctly", async ({ request }) => {
    const response = await request.get(`${items}?limit=5&offset=0`, {
      headers: authHeaders(savedToken("TEST_STATUS_FILTER_TOKEN")),
    });
    expect(response.status()).toBe(200);
  });

  test("administrator sees items of every status", async ({ request }) => {
    const response = await request.get(items, {
      headers: authHeaders(authTokens.admin),
    });
    expect(response.status()).toBe(200);
  });
});
```

### Setup Script Pattern

Create test users with specific filter permissions via a setup script:

```javascript
// scripts/setup-filter-tests.mjs
// Creates, through the Engine's API with the test administrator's session:
// - Test roles (POST /api/roles) and one policy per filter (POST /api/policies),
//   attached to the roles (POST /api/access)
// - Test permissions with filter JSON on the collection (POST /api/permissions):
//   status, self-access ($CURRENT_USER), role-based ($CURRENT_ROLE)
// - Test users (POST /api/users), each given a role in the project's tenant
//   (POST /api/users/:id/roles); users are looked up first, because every
//   create spends the account budget
// Signs each user in directly and saves the access tokens to
// playwright/.auth/tokens.json (TEST_STATUS_FILTER_TOKEN, ...)
```

<!-- /buildpad-backend -->
<!-- buildpad-backend: supabase -->
## Field-Level Permissions Test Patterns

Test that field access control correctly filters response data and validates writes.

### Test Structure

```
tests/api/field-permissions/
├── field-filtering-read.spec.ts    # Field filtering on GET
└── field-validation-write.spec.ts  # Field validation on POST/PATCH
```

### Field Permission Test Pattern

```typescript
import { test, expect } from "@playwright/test";
import { authHeaders, authTokens } from "../helpers/auth-tokens";

test.describe("Field-Level Permissions", () => {
  test.describe("Read Operations", () => {
    test("admin sees all fields including sensitive ones", async ({
      request,
    }) => {
      const response = await request.get("/api/users/some-id", {
        headers: authHeaders(authTokens.admin),
      });
      const data = await response.json();
      expect(Object.keys(data.data)).toContain("token");
    });

    test("limited user sees only allowed fields", async ({ request }) => {
      // User with fields: ['id', 'email', 'first_name', 'last_name', 'status']
      const response = await request.get("/api/users", {
        headers: authHeaders(authTokens.limitedUser),
      });
      const data = await response.json();
      const keys = Object.keys(data.data[0]);
      expect(keys).toContain("id");
      expect(keys).toContain("email");
      expect(keys).not.toContain("token");
    });

    test("wildcard user sees all fields", async ({ request }) => {
      // User with fields: ['*']
      const response = await request.get("/api/users");
      const data = await response.json();
      expect(Object.keys(data.data[0]).length).toBeGreaterThan(5);
    });

    test("multiple policies merge fields with OR logic", async ({
      request,
    }) => {
      // Policy 1 fields: ['id', 'email']
      // Policy 2 fields: ['id', 'first_name', 'status']
      // Merged: ['id', 'email', 'first_name', 'status']
    });
  });

  test.describe("Write Operations", () => {
    test("admin can update any field", async ({ request }) => {
      const response = await request.patch("/api/users/some-id", {
        data: { status: "suspended" },
        headers: authHeaders(authTokens.admin),
      });
      expect(response.status()).toBe(200);
    });

    test("limited user blocked from forbidden fields", async ({ request }) => {
      const response = await request.patch("/api/users/some-id", {
        data: { status: "active" },
        headers: authHeaders(authTokens.limitedUser),
      });
      expect(response.status()).toBe(403);
      const error = await response.json();
      // Error should list forbidden fields
      expect(JSON.stringify(error)).toContain("status");
    });

    test("empty fields user cannot create or update", async ({ request }) => {
      // User with fields: [] or null
      const response = await request.post("/api/users", {
        data: { email: "new@example.com" },
        headers: authHeaders(authTokens.noFieldsUser),
      });
      expect(response.status()).toBe(403);
    });
  });
});
```

### Setup Script Pattern

```typescript
// scripts/setup-field-permission-tests.ts
// Creates:
// - 5 test users with different field permission patterns
// - 5 test roles and policies
// - Permissions with field restrictions: limited, wildcard, empty, null, multi-policy
// Saves auth tokens to .env.test.local
```

<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## Field-Level Permissions Test Patterns

Test that field access control correctly filters response data and validates writes. On an Engine project a permission's `fields` list limits the fields a read returns and a write may name; `["*"]` allows every field, and the lists of several matching rules merge into their union. A create or update that names a field outside the list is refused with `403` (`FORBIDDEN`), and the message names the fields. The Engine returns no user's static token in any read, so test field lists on a field of your own collection.

### Test Structure

```
tests/api/field-permissions/
├── field-filtering-read.spec.ts    # Field filtering on GET
└── field-validation-write.spec.ts  # Field validation on POST/PATCH
```

### Field Permission Test Pattern

```typescript
import { test, expect } from "@playwright/test";
import {
  authHeaders,
  authTokens,
  engineUrl,
  savedToken,
} from "../helpers/auth-tokens";

const items = `${engineUrl}/api/items/[collection]`;

test.describe("Field-Level Permissions", () => {
  test.describe("Read Operations", () => {
    test("admin sees all fields including sensitive ones", async ({
      request,
    }) => {
      const response = await request.get(`${items}/some-id`, {
        headers: authHeaders(authTokens.admin),
      });
      const data = await response.json();
      expect(Object.keys(data.data)).toContain("sensitive_field");
    });

    test("limited user sees only allowed fields", async ({ request }) => {
      // User with fields: ['id', 'name', 'status']
      const response = await request.get(items, {
        headers: authHeaders(authTokens.limitedUser),
      });
      const data = await response.json();
      const keys = Object.keys(data.data[0]);
      expect(keys).toContain("id");
      expect(keys).toContain("name");
      expect(keys).not.toContain("sensitive_field");
    });

    test("wildcard user sees all fields", async ({ request }) => {
      // User with fields: ['*']
      const response = await request.get(items, {
        headers: authHeaders(savedToken("TEST_WILDCARD_USER_TOKEN")),
      });
      const data = await response.json();
      expect(Object.keys(data.data[0])).toContain("sensitive_field");
    });

    test("two policies merge their fields", async ({ request }) => {
      // Policy 1 fields: ['id', 'name']
      // Policy 2 fields: ['id', 'status']
      // Merged: ['id', 'name', 'status']
      const response = await request.get(items, {
        headers: authHeaders(savedToken("TEST_TWO_POLICIES_FIELDS_TOKEN")),
      });
      const keys = Object.keys((await response.json()).data[0]);
      expect(keys).toEqual(expect.arrayContaining(["id", "name", "status"]));
      expect(keys).not.toContain("sensitive_field");
    });
  });

  test.describe("Write Operations", () => {
    test("admin can update any field", async ({ request }) => {
      const response = await request.patch(`${items}/some-id`, {
        data: { sensitive_field: "value" },
        headers: authHeaders(authTokens.admin),
      });
      expect(response.status()).toBe(200);
    });

    test("limited user blocked from forbidden fields", async ({ request }) => {
      // User with update fields: ['name', 'status']
      const response = await request.patch(`${items}/some-id`, {
        data: { sensitive_field: "value" },
        headers: authHeaders(authTokens.limitedUser),
      });
      expect(response.status()).toBe(403);
      const error = await response.json();
      expect(error.errors[0].extensions.code).toBe("FORBIDDEN");
      // The message names the forbidden fields
      expect(error.errors[0].message).toContain("sensitive_field");
    });

    test("empty fields user cannot create or update", async ({ request }) => {
      // User with fields: []
      const response = await request.post(items, {
        data: { name: "New item" },
        headers: authHeaders(savedToken("TEST_NO_FIELDS_USER_TOKEN")),
      });
      expect(response.status()).toBe(403);
    });
  });
});
```

### Setup Script Pattern

```typescript
// scripts/setup-field-permission-tests.ts
// Creates, through the Engine's API with the test administrator's session:
// - 4 test users with different field permission patterns: limited, wildcard,
//   empty, two policies (looked up first: every create spends the account budget)
// - Their test roles and policies, one policy per rule, attached with POST /api/access
// - Permissions with field restrictions (POST /api/permissions with `fields`)
// Saves the users' access tokens to playwright/.auth/tokens.json
// (TEST_LIMITED_USER_TOKEN, TEST_WILDCARD_USER_TOKEN, ...)
```

<!-- /buildpad-backend -->
<!-- buildpad-backend: supabase -->
## Permissions-Aware UI Test Patterns

Test that the frontend correctly shows/hides features based on the current user's permissions from `/api/permissions/me`.

### What to Test

| UI Element        | Admin       | Read-Only                 | No Permission           |
| ----------------- | ----------- | ------------------------- | ----------------------- |
| Navigation links  | All visible | Only readable collections | Hidden                  |
| Add/Create button | Visible     | Hidden                    | Hidden                  |
| Edit button       | Enabled     | Disabled                  | Hidden                  |
| Delete button     | Visible     | Hidden                    | Hidden                  |
| Table/List        | Renders     | Renders                   | "No access" or redirect |
| Menu button       | Visible     | Conditional               | Hidden                  |

### Patterns

```typescript
test.describe("[Collection] Permissions UI", () => {
  // Permissions API endpoint tests
  test.describe("Permissions API", () => {
    test.use({ storageState: "playwright/.auth/admin.json" });

    test("admin gets full access", async ({ request }) => {
      const response = await request.get("/api/permissions/me");
      const data = await response.json();
      // Admin should have create, read, update, delete for all collections
      expect(data["daas_users"]).toMatchObject({
        create: true,
        read: true,
        update: true,
        delete: true,
      });
    });
  });

  // Navigation tests
  test.describe("Navigation - Admin", () => {
    test.use({ storageState: "playwright/.auth/admin.json" });

    test("shows all navigation links", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Roles" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Policies" })).toBeVisible();
    });
  });

  test.describe("Navigation - Read-Only", () => {
    test.use({ storageState: "playwright/.auth/readonly.json" });

    test("shows links only for readable collections", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      // Read-only user should see links for collections they can read
    });
  });

  // Action button tests
  test.describe("Action Buttons - Admin", () => {
    test.use({ storageState: "playwright/.auth/admin.json" });

    test("shows Add button", async ({ page }) => {
      await page.goto("/[collection]");
      await expect(page.getByRole("button", { name: /add/i })).toBeVisible();
    });
  });

  test.describe("Action Buttons - Read-Only", () => {
    test.use({ storageState: "playwright/.auth/readonly.json" });

    test("hides Add button", async ({ page }) => {
      await page.goto("/[collection]");
      await expect(page.getByRole("button", { name: /add/i })).toBeHidden();
    });

    test("disables edit actions", async ({ page }) => {
      await page.goto("/[collection]");
      // Edit buttons disabled or hidden for read-only user
    });
  });
});
```

### Frontend Permission Pattern Reference

The frontend uses `useCollectionPermissions` hook:

```typescript
const { permissions } = useCollectionPermissions('daas_users');
// permissions = { create: boolean, read: boolean, update: boolean, delete: boolean }

{permissions.create && <button>Add User</button>}
{permissions.update && <button>Edit</button>}
{permissions.delete && <button>Delete</button>}
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## Permissions-Aware UI Test Patterns

Test that the frontend correctly shows/hides features based on the current user's permissions from `/api/permissions/me`. On an Engine project that answer is:

```json
{
  "data": {
    "[collection]": {
      "read": { "fields": ["*"], "permissions": null, "validation": null, "presets": null }
    }
  },
  "isAdmin": false,
  "moduleAccess": {},
  "meta": { "user_id": "…", "role_ids": ["…"], "policy_ids": ["…"], "admin_bypass": false, "resource_uri": null }
}
```

`isAdmin` sits beside `data`, not inside it. A collection is listed with the actions the user holds, and an action the user does not hold is absent. For an administrator `isAdmin` is `true` and `data` is `{}`: a screen checks `isAdmin` before it reads `data`.

### What to Test

| UI Element        | Admin       | Read-Only                 | No Permission           |
| ----------------- | ----------- | ------------------------- | ----------------------- |
| Navigation links  | All visible | Only readable collections | Hidden                  |
| Add/Create button | Visible     | Hidden                    | Hidden                  |
| Edit button       | Enabled     | Disabled                  | Hidden                  |
| Delete button     | Visible     | Hidden                    | Hidden                  |
| Table/List        | Renders     | Renders                   | "No access" or redirect |
| Menu button       | Visible     | Conditional               | Hidden                  |

### Patterns

```typescript
test.describe("[Collection] Permissions UI", () => {
  // Permissions API endpoint tests
  test.describe("Permissions API - Admin", () => {
    test.use({ storageState: "playwright/.auth/admin.json" });

    test("admin is reported beside data", async ({ request }) => {
      const response = await request.get("/api/permissions/me");
      const body = await response.json();
      // isAdmin sits beside data; an administrator's data is empty
      expect(body.isAdmin).toBe(true);
      expect(body.data).toEqual({});
    });
  });

  test.describe("Permissions API - Read-Only", () => {
    test.use({ storageState: "playwright/.auth/readonly.json" });

    test("read-only user holds read only", async ({ request }) => {
      const response = await request.get("/api/permissions/me");
      const body = await response.json();
      expect(body.isAdmin).toBe(false);
      expect(body.data["[collection]"].read).toBeDefined();
      expect(body.data["[collection]"].create).toBeUndefined();
      expect(body.data["[collection]"].delete).toBeUndefined();
    });
  });

  // Navigation tests
  test.describe("Navigation - Admin", () => {
    test.use({ storageState: "playwright/.auth/admin.json" });

    test("shows all navigation links", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Roles" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Policies" })).toBeVisible();
    });
  });

  test.describe("Navigation - Read-Only", () => {
    test.use({ storageState: "playwright/.auth/readonly.json" });

    test("shows links only for readable collections", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      // Read-only user should see links for collections they can read
    });
  });

  // Action button tests
  test.describe("Action Buttons - Admin", () => {
    test.use({ storageState: "playwright/.auth/admin.json" });

    test("shows Add button", async ({ page }) => {
      await page.goto("/[collection]");
      await expect(page.getByRole("button", { name: /add/i })).toBeVisible();
    });
  });

  test.describe("Action Buttons - Read-Only", () => {
    test.use({ storageState: "playwright/.auth/readonly.json" });

    test("hides Add button", async ({ page }) => {
      await page.goto("/[collection]");
      await expect(page.getByRole("button", { name: /add/i })).toBeHidden();
    });

    test("disables edit actions", async ({ page }) => {
      await page.goto("/[collection]");
      // Edit buttons disabled or hidden for read-only user
    });
  });
});
```

### Frontend Permission Pattern Reference

The frontend uses `useCollectionPermissions` hook:

```typescript
const { permissions } = useCollectionPermissions('[collection]');
// permissions = { create: boolean, read: boolean, update: boolean, delete: boolean }

{permissions.create && <button>Add Item</button>}
{permissions.update && <button>Edit</button>}
{permissions.delete && <button>Delete</button>}
```

On an Engine project the hook's answer comes from `GET /api/permissions/me`. An administrator may do every action although `data` names no collection, so a hook that reads that answer treats `isAdmin: true` as every action allowed.
<!-- /buildpad-backend -->

## DaaS Query Parameters Test Patterns

Test DaaS-compatible query parameters (Directus-style) for collection endpoints.

### Fields Parameter

```typescript
test.describe("Fields Parameter", () => {
  test("returns specific fields only", async ({ request }) => {
    const response = await request.get(
      "/api/[collection]?fields=id,email,first_name",
    );
    const data = await response.json();
    const keys = Object.keys(data.data[0]);
    expect(keys).toContain("id");
    expect(keys).toContain("email");
    expect(keys).not.toContain("password");
  });

  test("returns all fields with wildcard", async ({ request }) => {
    const response = await request.get("/api/[collection]?fields=*");
    const data = await response.json();
    expect(Object.keys(data.data[0]).length).toBeGreaterThan(3);
  });

  test("returns nested relation fields", async ({ request }) => {
    const response = await request.get(
      "/api/[collection]?fields=id,email,role.name,role.icon",
    );
    const data = await response.json();
    if (data.data[0].role) {
      expect(data.data[0].role).toHaveProperty("name");
    }
  });
});
```

### Filter Parameter

```typescript
test.describe("Filter Parameter", () => {
  test("filters with _eq operator", async ({ request }) => {
    const filter = JSON.stringify({ status: { _eq: "active" } });
    const response = await request.get(`/api/[collection]?filter=${filter}`);
    const data = await response.json();
    data.data.forEach((item: any) => expect(item.status).toBe("active"));
  });

  test("filters with _neq operator", async ({ request }) => {
    const filter = JSON.stringify({ status: { _neq: "archived" } });
    const response = await request.get(`/api/[collection]?filter=${filter}`);
    const data = await response.json();
    data.data.forEach((item: any) => expect(item.status).not.toBe("archived"));
  });

  test("filters with _in operator", async ({ request }) => {
    const filter = JSON.stringify({ status: { _in: ["active", "invited"] } });
    const response = await request.get(`/api/[collection]?filter=${filter}`);
    const data = await response.json();
    data.data.forEach((item: any) => {
      expect(["active", "invited"]).toContain(item.status);
    });
  });

  test("filters with complex AND conditions", async ({ request }) => {
    const filter = JSON.stringify({
      _and: [{ status: { _eq: "active" } }, { first_name: { _neq: null } }],
    });
    const response = await request.get(`/api/[collection]?filter=${filter}`);
    expect(response.status()).toBe(200);
  });

  test("filters with complex OR conditions", async ({ request }) => {
    const filter = JSON.stringify({
      _or: [{ status: { _eq: "active" } }, { status: { _eq: "invited" } }],
    });
    const response = await request.get(`/api/[collection]?filter=${filter}`);
    expect(response.status()).toBe(200);
  });
});
```

### Sort, Pagination, Meta, Search Parameters

```typescript
test.describe("Sort Parameter", () => {
  test("sorts ascending by default", async ({ request }) => {
    const response = await request.get("/api/[collection]?sort=email");
    expect(response.status()).toBe(200);
  });

  test("sorts descending with - prefix", async ({ request }) => {
    const response = await request.get("/api/[collection]?sort=-date_created");
    expect(response.status()).toBe(200);
  });

  test("sorts by multiple fields", async ({ request }) => {
    const response = await request.get("/api/[collection]?sort=status,-email");
    expect(response.status()).toBe(200);
  });
});

test.describe("Pagination Parameters", () => {
  test("limits results", async ({ request }) => {
    const response = await request.get("/api/[collection]?limit=5");
    const data = await response.json();
    expect(data.data.length).toBeLessThanOrEqual(5);
  });

  test("offsets results", async ({ request }) => {
    const response = await request.get("/api/[collection]?limit=5&offset=5");
    expect(response.status()).toBe(200);
  });

  test("paginates with page parameter", async ({ request }) => {
    const response = await request.get("/api/[collection]?limit=10&page=1");
    expect(response.status()).toBe(200);
  });
});

test.describe("Meta Parameter", () => {
  test("returns total_count", async ({ request }) => {
    const response = await request.get("/api/[collection]?meta=total_count");
    const data = await response.json();
    expect(data.meta.total_count).toBeDefined();
    expect(typeof data.meta.total_count).toBe("number");
  });

  test("returns filter_count", async ({ request }) => {
    const response = await request.get("/api/[collection]?meta=filter_count");
    const data = await response.json();
    expect(data.meta.filter_count).toBeDefined();
  });

  test("returns all meta with *", async ({ request }) => {
    const response = await request.get("/api/[collection]?meta=*");
    const data = await response.json();
    expect(data.meta).toBeDefined();
  });
});

test.describe("Search Parameter", () => {
  test("searches across text fields", async ({ request }) => {
    const response = await request.get("/api/[collection]?search=keyword");
    expect(response.status()).toBe(200);
  });

  test("search is case-insensitive", async ({ request }) => {
    const response = await request.get("/api/[collection]?search=KEYWORD");
    expect(response.status()).toBe(200);
  });

  test("partial match search", async ({ request }) => {
    const response = await request.get("/api/[collection]?search=key");
    expect(response.status()).toBe(200);
  });
});
```

## Form Change Detection Test Patterns

Test the edit-mode form change detection pattern (only submitting changed fields):

```typescript
test.describe("Form Change Detection", () => {
  test.use({ storageState: "playwright/.auth/admin.json" });

  test("save button disabled when no changes", async ({ page }) => {
    await page.goto("/[collection]/item-id");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  test("save button enabled after field change", async ({ page }) => {
    await page.goto("/[collection]/item-id");
    await page.waitForLoadState("networkidle");
    await page.getByRole("textbox", { name: "first_name" }).fill("Updated");
    await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  test("dirty indicator shows modified field count", async ({ page }) => {
    await page.goto("/[collection]/item-id");
    await page.waitForLoadState("networkidle");
    await page.getByRole("textbox", { name: "first_name" }).fill("Updated");
    // Check for "1 field modified" or similar indicator
    await expect(page.getByText(/field.* modified/i)).toBeVisible();
  });

  test("reverting field removes it from edits", async ({ page }) => {
    await page.goto("/[collection]/item-id");
    await page.waitForLoadState("networkidle");
    const input = page.getByRole("textbox", { name: "first_name" });
    const originalValue = await input.inputValue();
    await input.fill("Temporary");
    await input.fill(originalValue); // Revert
    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  test("only changed fields sent in PATCH request", async ({ page }) => {
    await page.goto("/[collection]/item-id");
    await page.waitForLoadState("networkidle");

    // Intercept the PATCH request
    const patchPromise = page.waitForRequest(
      (req) =>
        req.method() === "PATCH" && req.url().includes("/api/[collection]"),
    );
    await page.getByRole("textbox", { name: "first_name" }).fill("Updated");
    await page.getByRole("button", { name: "Save" }).click();

    const patchRequest = await patchPromise;
    const body = patchRequest.postDataJSON();
    // Only the changed field should be in the payload
    expect(Object.keys(body)).toContain("first_name");
    expect(Object.keys(body)).not.toContain("email");
  });
});
```

## Mantine / Buildpad UI Selector Strategies

### Login Page Selectors

```typescript
// ✅ RECOMMENDED: Role-based selectors (most reliable for Mantine)
await page.getByRole("textbox", { name: "Email" }).fill("admin@example.com");
await page.getByRole("textbox", { name: "Password" }).fill("password");
await page.getByRole("button", { name: "Sign In" }).click();

// ✅ For PasswordInput (Mantine), use role with exact match
await page
  .getByRole("textbox", { name: "Password", exact: true })
  .fill("password");
await page.getByRole("textbox", { name: "Confirm Password" }).fill("password");

// ❌ AVOID: Placeholder-based selectors (can change with UI updates)
await page.fill('input[placeholder="admin@example.com"]', "admin@example.com");

// ❌ AVOID: getByLabel for PasswordInput (may match multiple fields)
await page.getByLabel("Password").fill("password"); // May match both Password and Confirm Password!
```

### General Mantine Component Selectors

```typescript
// Buttons
await page.getByRole("button", { name: "Save Changes" }).click();
await page.getByRole("button", { name: /submit/i }).click(); // Regex for flexibility

// Text Inputs with labels
await page.getByRole("textbox", { name: "first_name" }).fill("John");
await page.getByRole("textbox", { name: "email" }).fill("john@example.com");

// Switches/Checkboxes
await page.getByRole("switch", { name: "notifications" }).check();

// Text elements
await expect(page.getByText("User created successfully")).toBeVisible();

// Required field indicator
await expect(page.getByText("Password *", { exact: true })).toBeVisible();

// Data test IDs (most reliable for complex components)
await page.getByTestId("submit-button").click();

// Mantine notifications
await expect(
  page.locator(".mantine-Notification-root").filter({ hasText: "Saved" }),
).toBeVisible();
```

### API Helpers with Page Request

When using API helper functions in tests, pass `page.request` for authenticated requests:

<!-- buildpad-backend: supabase -->
```typescript
test.beforeEach(async ({ page }) => {
  testRole = await createTestRoleViaAPI(page.request, "Test Role");
  testUser = await createTestUserViaAPI(page.request, "test@example.com");
});

test.afterEach(async ({ page }) => {
  await deleteUserViaAPI(page.request, testUser.id);
  await deleteRoleViaAPI(page.request, testRole.id);
});
```

<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
```typescript
test.beforeEach(async ({ page }) => {
  testRole = await createTestRoleViaAPI(page.request, "Test Role");
});

test.afterEach(async ({ page }) => {
  await deleteRoleViaAPI(page.request, testRole.id);
});
```

On an Engine project do not create a user in `beforeEach`: every account creation spends the Engine's account budget (30 per caller per 10 minutes by default), and a suite that creates a user per test is soon answered `429`. Use the test users that `tests/setup-test-users.ts` created once, and create only other data per test.

<!-- /buildpad-backend -->
<!-- buildpad-backend: supabase -->
## Load Testing with k6

For performance testing, use k6 to validate API can handle expected traffic.

### Setup

```bash
# Install k6
brew install k6  # macOS
# or: sudo apt-get install k6 / choco install k6 / npm install -g k6

# Setup test environment (creates users, generates tokens)
pnpm load:setup

# Run tests
pnpm load:smoke    # Quick test (1 min, 1 VU)
pnpm load:test     # Standard load test (16 min, 10-20 VUs)
pnpm load:stress   # Stress test (23 min, 20-60 VUs)
pnpm load:spike    # Spike test (5 min, 5-100 VUs)
```

### Test Scenarios

| Scenario | Duration | Users    | p95 Threshold | Error Threshold |
| -------- | -------- | -------- | ------------- | --------------- |
| Smoke    | 1 min    | 1 VU     | < 500ms       | < 10%           |
| Load     | 16 min   | 10→20    | < 800ms       | < 5%            |
| Stress   | 23 min   | 20→40→60 | < 1500ms      | < 10%           |
| Spike    | 5 min    | 5→100→5  | < 2000ms      | < 20%           |

### Request Distribution

- **50%** GET list items (with pagination, filters, field selection)
- **25%** GET single item (random item from lists)
- **15%** POST create item (unique data generation)
- **10%** PATCH update item (partial updates)

### Key Metrics

| Metric                    | What It Measures              | Good        | Warning        | Critical         |
| ------------------------- | ----------------------------- | ----------- | -------------- | ---------------- |
| `checks`                  | Assertion pass rate           | 100%        | > 95%          | < 95%            |
| `http_req_duration p(95)` | 95th percentile response time | < threshold | 1.5x threshold | > 2x threshold   |
| `errors`                  | Error rate                    | 0%          | < 5%           | > 10%            |
| `http_reqs`               | Throughput (req/sec)          | High        | Declining      | Flat or dropping |

**Note:** Auth tokens expire after 1 hour. Re-run `pnpm load:setup` if tests fail with 401.
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## Load Testing with k6

For performance testing, use k6 to validate API can handle expected traffic. On an Engine project a k6 script sends a test user's access token as `Authorization: Bearer <access token>` to `<Engine_URL>/api/items/<collection>`; never the token in the project's MCP configuration.

### Setup

```bash
# Install k6
brew install k6  # macOS
# or: sudo apt-get install k6 / choco install k6 / npm install -g k6

# Setup test environment (signs the test users in, saves tokens; creates only missing users)
pnpm load:setup

# Run tests
pnpm load:smoke    # Quick test (1 min, 1 VU)
pnpm load:test     # Standard load test (16 min, 10-20 VUs)
pnpm load:stress   # Stress test (23 min, 20-60 VUs)
pnpm load:spike    # Spike test (5 min, 5-100 VUs)
```

### Rate Budget

The Engine serves 20 requests per second per client address unless its operator set `RATE_LIMIT_RPS`, and answers `429` (`REQUESTS_EXCEEDED`) beyond it. A k6 run from one machine is one client address. Run the Smoke scenario against any Engine; run the Load, Stress and Spike scenarios only against an Engine whose operator raised the limit for the test, or they measure the limiter instead of the Engine. Count `429` answers apart from other errors. Creating accounts has its own budget (30 per caller per 10 minutes by default): `pnpm load:setup` reuses the test users and never creates one per virtual user.

### Test Scenarios

| Scenario | Duration | Users    | p95 Threshold | Error Threshold |
| -------- | -------- | -------- | ------------- | --------------- |
| Smoke    | 1 min    | 1 VU     | < 500ms       | < 10%           |
| Load     | 16 min   | 10→20    | < 800ms       | < 5%            |
| Stress   | 23 min   | 20→40→60 | < 1500ms      | < 10%           |
| Spike    | 5 min    | 5→100→5  | < 2000ms      | < 20%           |

### Request Distribution

- **50%** GET list items (with pagination, filters, field selection)
- **25%** GET single item (random item from lists)
- **15%** POST create item (unique data generation; answered `200`)
- **10%** PATCH update item (partial updates)

### Key Metrics

| Metric                    | What It Measures              | Good        | Warning        | Critical         |
| ------------------------- | ----------------------------- | ----------- | -------------- | ---------------- |
| `checks`                  | Assertion pass rate           | 100%        | > 95%          | < 95%            |
| `http_req_duration p(95)` | 95th percentile response time | < threshold | 1.5x threshold | > 2x threshold   |
| `errors`                  | Error rate                    | 0%          | < 5%           | > 10%            |
| `http_reqs`               | Throughput (req/sec)          | High        | Declining      | Flat or dropping |

**Note:** Access tokens expire after 1 hour by default (the Engine's operator may set another lifetime). Re-run `pnpm load:setup` if tests fail with 401 (`TOKEN_EXPIRED`).
<!-- /buildpad-backend -->

## Debugging Strategies

### Playwright Inspector

```bash
pnpm test:debug                          # Open Inspector for all tests
pnpm test tests/api/file.spec.ts --debug # Debug specific test
```

### Screenshots and Videos

```typescript
// playwright.config.ts
use: {
  screenshot: "only-on-failure",  // Auto screenshot on failure
  video: "retain-on-failure",     // Record video, keep on failure
  trace: "on-first-retry",        // Trace on retry
}

// Manual screenshot in test
await page.screenshot({ path: "screenshot.png" });
```

### Console and Network Logging

```typescript
// Listen to browser console
page.on("console", (msg) => console.log("Browser:", msg.text()));

// Watch network requests
page.on("request", (req) => console.log("→", req.method(), req.url()));
page.on("response", (res) => console.log("←", res.status(), res.url()));
```

### Interactive UI Mode

```bash
pnpm test:ui  # Visual test runner with time-travel debugging
```

## CI/CD Integration

### GitHub Actions

<!-- buildpad-backend: supabase -->
```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 24
      - run: pnpm install
      - run: pnpm exec playwright install --with-deps
      - run: pnpm test
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 24
      - run: pnpm install
      - run: pnpm exec playwright install --with-deps
      - run: pnpm tsx tests/setup-test-users.ts
        env:
          NEXT_PUBLIC_BUILDPAD_DAAS_URL: ${{ vars.ENGINE_URL }}
          NEXT_PUBLIC_BUILDPAD_TENANT_ID: ${{ vars.BUILDPAD_TENANT_ID }}
          TEST_ADMIN_EMAIL: ${{ secrets.TEST_ADMIN_EMAIL }}
          TEST_ADMIN_PASSWORD: ${{ secrets.TEST_ADMIN_PASSWORD }}
      - run: pnpm test
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ vars.ENGINE_URL }}
          NEXT_PUBLIC_BUILDPAD_DAAS_URL: ${{ vars.ENGINE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: buildpad-engine-public-anon-key
          NEXT_PUBLIC_BUILDPAD_TENANT_ID: ${{ vars.BUILDPAD_TENANT_ID }}
          TEST_ADMIN_EMAIL: ${{ secrets.TEST_ADMIN_EMAIL }}
          TEST_ADMIN_PASSWORD: ${{ secrets.TEST_ADMIN_PASSWORD }}
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

The Engine_URL and the tenant id are not secrets: keep them as repository variables. The test administrator's email and password are the only secrets the pipeline needs.
<!-- /buildpad-backend -->

### Test Reports

```bash
# Generate and open HTML report
pnpm exec playwright show-report

# Generate JSON report
pnpm test --reporter=json --output=test-results.json
```

## Required Coverage

For each feature implementation, ensure:

| Test Type             | Minimum Coverage                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| API Tests             | All CRUD operations, validation, error cases, query parameters (fields, filter, search, sort, pagination, meta) |
| Security/RLS Tests    | 401 unauthenticated, 403 unauthorized, admin bypass, self-access, data isolation                                |
| Field Permissions     | Admin full access, limited read, blocked writes (403), wildcard, merging                                        |
| Permissions UI        | Navigation links, action buttons (create/edit/delete), conditional rendering                                    |
| Page Tests            | List, detail, create, navigation, search/filter                                                                 |
| Component Tests       | Interactive components with forms/modals, form change detection                                                 |
| E2E Tests             | Critical user flows, workflow transitions                                                                       |
| Load Tests (optional) | Smoke test passes, p95 meets thresholds                                                                         |
