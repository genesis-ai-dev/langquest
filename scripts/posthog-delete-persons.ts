#!/usr/bin/env node

interface PostHogPerson {
  type: string;
  id?: string;
  [key: string]: unknown;
}

interface PostHogResponse {
  results: PostHogPerson[];
  next?: string | null;
}

interface BulkDeleteResponse {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
}

/**
 * Fetches all persons from PostHog API
 */
async function fetchAllPersons(
  projectId: string,
  apiToken: string,
  baseUrl = 'https://us.posthog.com'
): Promise<string[]> {
  const allPersonIds: string[] = [];
  let nextUrl: string | null =
    `${baseUrl}/api/projects/${projectId}/persons?limit=10000`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `PostHog API error: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    const data = (await response.json()) as PostHogResponse;

    // Extract person IDs
    const personIds = data.results
      .filter(
        (item): item is PostHogPerson & { id: string } =>
          item.type === 'person' && Boolean(item.id)
      )
      .map((item) => item.id);

    allPersonIds.push(...personIds);

    // Check if there's a next page
    nextUrl = data.next || null;

    if (nextUrl && !nextUrl.startsWith('http')) {
      // If next is a relative URL, make it absolute
      nextUrl = `${baseUrl}${nextUrl}`;
    }

    console.error(
      `Fetched ${personIds.length} persons (total: ${allPersonIds.length})...`
    );
  }

  return allPersonIds;
}

/**
 * Deletes persons from PostHog using bulk delete API
 */
async function bulkDeletePersons(
  projectId: string,
  personIds: string[],
  apiToken: string,
  baseUrl = 'https://us.posthog.com'
): Promise<void> {
  if (personIds.length === 0) {
    console.error('No person IDs to delete');
    return;
  }

  const deleteUrl = `${baseUrl}/api/projects/${projectId}/persons/bulk_delete/`;

  console.error(`\nDeleting ${personIds.length} persons...`);
  console.error('delete_events: true');

  const response = await fetch(deleteUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      delete_events: true,
      ids: personIds
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `PostHog bulk delete API error: ${response.status} ${response.statusText}\n${errorText}`
    );
  }

  const result = (await response.json()) as BulkDeleteResponse;

  if (result.success === false) {
    throw new Error(`Bulk delete failed: ${result.message || 'Unknown error'}`);
  }

  console.error(`\n✓ Successfully deleted ${personIds.length} persons`);
  if (result.message) {
    console.error(`  ${result.message}`);
  }
}

/**
 * Prints usage information
 */
function printUsage(): void {
  console.error('PostHog Bulk Person Deletion Script');
  console.error('');
  console.error('Usage:');
  console.error(
    '  npx tsx scripts/posthog-delete-persons.ts <project-id> <api-token> [--dry-run]'
  );
  console.error('');
  console.error('Arguments:');
  console.error('  project-id    PostHog project ID (required)');
  console.error('  api-token     PostHog API token (required)');
  console.error('');
  console.error('Options:');
  console.error(
    '  --dry-run    Show what would be deleted without actually deleting'
  );
  console.error('');
  console.error('Environment variables (optional):');
  console.error(
    '  POSTHOG_API_TOKEN    PostHog API token (fallback if not passed as argument)'
  );
  console.error(
    '  POSTHOG_BASE_URL     PostHog base URL (default: https://us.posthog.com)'
  );
  console.error('');
  console.error('Examples:');
  console.error('  # Dry run to see what would be deleted');
  console.error(
    '  npx tsx scripts/posthog-delete-persons.ts 150565 phx_xxx --dry-run'
  );
  console.error('');
  console.error('  # Delete all persons from a project');
  console.error('  npx tsx scripts/posthog-delete-persons.ts 150565 phx_xxx');
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const nonFlagArgs = args.filter((arg) => !arg.startsWith('--'));
  const projectId = nonFlagArgs[0];
  const apiToken = nonFlagArgs[1] || process.env.POSTHOG_API_TOKEN;
  const baseUrl = process.env.POSTHOG_BASE_URL || 'https://us.posthog.com';
  const dryRun = process.argv.includes('--dry-run');

  // Show usage if no project ID
  if (!projectId) {
    printUsage();
    process.exit(1);
  }

  // Validate API token
  if (!apiToken) {
    console.error('Error: PostHog API token is required');
    console.error('Pass as second argument: <project-id> <api-token>');
    process.exit(1);
  }

  try {
    // Fetch from PostHog
    console.error(`Fetching all persons from PostHog project ${projectId}...`);
    const personIds = await fetchAllPersons(projectId, apiToken, baseUrl);

    if (personIds.length === 0) {
      console.error('No persons found in the project');
      process.exit(0);
    }

    console.error(`\nFound ${personIds.length} persons`);

    // Perform deletion
    if (dryRun) {
      console.error('\n[DRY RUN] Would delete the following persons:');
      console.error(`  Total: ${personIds.length}`);
      console.error(`  delete_events: true`);
      console.error(`  First 10 IDs: ${personIds.slice(0, 10).join(', ')}`);
      if (personIds.length > 10) {
        console.error(`  ... and ${personIds.length - 10} more`);
      }
      console.error('\nRun without --dry-run to actually delete them');
    } else {
      await bulkDeletePersons(projectId, personIds, apiToken, baseUrl);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error:', errorMessage);
    process.exit(1);
  }
}

// Run the script
void main();
