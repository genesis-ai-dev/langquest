interface SupabaseFile {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: any;
}

interface AssetContentLink {
  id: string;
  created_at: string;
  last_updated: string;
  audio_id: string;
  text: string;
}

const SUPABASE_BASE_URL =
  'https://api.supabase.com/platform/storage/unsxkmlcyxgtgmtzfonb/buckets/assets/objects';
const SUPABASE_DB_URL =
  'https://api.supabase.com/platform/pg-meta/unsxkmlcyxgtgmtzfonb/query?key=table-rows-97227';
const BEARER_TOKEN =
  'eyJhbGciOiJIUzI1NiIsImtpZCI6IjlQN2lyemptNDR4U01qdnEiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FsdC5zdXBhYmFzZS5pby9hdXRoL3YxIiwic3ViIjoiOGVmMmFmYmMtY2ZmNC00MjM0LThlMTYtOTZiZmE2YTIyZTUwIiwiYXVkIjoiYXV0aGVudGljYXRlZCIsImV4cCI6MTc0MTQ2OTc3NSwiaWF0IjoxNzQxNDY5MTc1LCJlbWFpbCI6InJlYWxkaW5vem9pZEBnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImdpdGh1YiIsInByb3ZpZGVycyI6WyJnaXRodWIiXX0sInVzZXJfbWV0YWRhdGEiOnsiYXZhdGFyX3VybCI6Imh0dHBzOi8vYXZhdGFycy5naXRodWJ1c2VyY29udGVudC5jb20vdS8zODY3NDg3OT92PTQiLCJlbWFpbCI6InJlYWxkaW5vem9pZEBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZnVsbF9uYW1lIjoiS2VlYW4iLCJpc3MiOiJodHRwczovL2FwaS5naXRodWIuY29tIiwibmFtZSI6IktlZWFuIiwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJrZWVhbmRldiIsInByb3ZpZGVyX2lkIjoiMzg2NzQ4NzkiLCJzdWIiOiIzODY3NDg3OSIsInVzZXJfbmFtZSI6ImtlZWFuZGV2In0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoib2F1dGgiLCJ0aW1lc3RhbXAiOjE3MzczMzY5OTJ9XSwic2Vzc2lvbl9pZCI6ImIzMDE0YzdkLThjNWUtNGQxMC05ZTQ1LTA1YTAzZmQ3N2U4MSIsImlzX2Fub255bW91cyI6ZmFsc2V9.evR6D2ve4Jz5X42aLnLNBcMLb60XDYIEIjw2pV1dOO4';

const dbHeaders = {
  accept: 'application/json',
  'accept-language': 'en-US,en;q=0.9',
  authorization: `Bearer ${BEARER_TOKEN}`,
  'content-type': 'application/json',
  priority: 'u=1, i',
  'sec-ch-ua': '"Not:A-Brand";v="24", "Chromium";v="134"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'x-connection-encrypted':
    'U2FsdGVkX19Phg/0aUXjUHHF5qogF2Ftwxmv+BLc2zvjyRZng2ianXfHEp2pNaoZ5u+jK47DGgRk4fMO384+Bl0Bsu2oOwCSWSunrkTlaJ+DU4OhZkR3ArJY64Rgp+5AYZiz2j3rmPbB9mc7zWXsUsc3ZHEJ8fOOhCx6vrVfztRGAkgBN0y4SYWv8jSmL7nr',
  'x-request-id': 'a8d1932c-877a-4689-a8ee-acb3c94e680d',
  Referer:
    'https://supabase.com/dashboard/project/unsxkmlcyxgtgmtzfonb/editor/97227?schema=public',
  'Referrer-Policy': 'no-referrer-when-downgrade'
};

const storageHeaders = {
  accept: 'application/json',
  'accept-language': 'en-US,en;q=0.9',
  authorization: `Bearer ${BEARER_TOKEN}`,
  'content-type': 'application/json',
  origin: 'https://supabase.com',
  referer:
    'https://supabase.com/dashboard/project/unsxkmlcyxgtgmtzfonb/storage/buckets/assets'
};

async function getAssetContentLinks(): Promise<AssetContentLink[]> {
  try {
    const response = await fetch(SUPABASE_DB_URL, {
      method: 'POST',
      headers: dbHeaders,
      body: JSON.stringify({
        query:
          'with _temp as (select * from public.asset_content_link order by asset_content_link.id asc nulls first limit 100 offset 0) select *, case when length("id"::text) > 10240 then concat(left("id"::text, 10240), \'...\') else "id"::text end "id",case when length("created_at"::text) > 10240 then concat(left("created_at"::text, 10240), \'...\') else "created_at"::text end "created_at",case when length("last_updated"::text) > 10240 then concat(left("last_updated"::text, 10240), \'...\') else "last_updated"::text end "last_updated",case when length("audio_id"::text) > 10240 then concat(left("audio_id"::text, 10240), \'...\') else "audio_id"::text end "audio_id",case when length("text"::text) > 10240 then concat(left("text"::text, 10240), \'...\') else "text"::text end "text" from _temp'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, body: ${errorText}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching asset content links:', error);
    return [];
  }
}

async function getAllFiles(): Promise<SupabaseFile[]> {
  try {
    const response = await fetch(`${SUPABASE_BASE_URL}/list`, {
      method: 'POST',
      headers: storageHeaders,
      body: JSON.stringify({
        path: '',
        options: {
          limit: 200,
          offset: 0,
          search: '',
          sortBy: {
            column: 'name',
            order: 'asc'
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching files:', error);
    return [];
  }
}

async function renameAsset(fromName: string, toName: string): Promise<boolean> {
  try {
    const response = await fetch(`${SUPABASE_BASE_URL}/move`, {
      method: 'POST',
      headers: storageHeaders,
      body: JSON.stringify({
        from: fromName,
        to: toName
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log(`Successfully renamed ${fromName} to ${toName}`);
    return true;
  } catch (error) {
    console.error(`Error renaming ${fromName}:`, error);
    return false;
  }
}

async function main() {
  // Get asset content links to know which files to process
  const assetLinks = await getAssetContentLinks();
  if (!assetLinks.length) {
    console.log('No asset content links found. Exiting.');
    return;
  }

  // Get all files from storage
  const files = await getAllFiles();
  if (!files.length) {
    console.log('No files found in storage. Exiting.');
    return;
  }

  // Create a set of audio_ids for quick lookup
  const audioIds = new Set(
    assetLinks.map((link) => link.audio_id.replace('.mp3', ''))
  );

  console.log(audioIds);

  // Process each file
  for (const file of files) {
    const currentName = file.name;

    // Check if this file is in our asset content links
    if (!audioIds.has(currentName.replace('.m4a', ''))) {
      console.log(
        `Skipping ${currentName} as it's not in our asset content links`
      );
      continue;
    }

    // Check if it's an .m4a file
    if (!currentName.endsWith('.m4a')) {
      console.log(`Skipping ${currentName} as it's not an .m4a file`);
      continue;
    }

    // Create the new name with .mp3 extension
    const newName = currentName.replace('.m4a', '.mp3');

    // Rename the file
    await renameAsset(currentName, newName);
  }
}

// Run the script
main().catch((error) => {
  console.error('Script failed:', error);
});
