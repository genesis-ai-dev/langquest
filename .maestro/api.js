const supabaseUrl = MAESTRO_SUPABASE_URL;
const serviceRoleKey = MAESTRO_SUPABASE_SERVICE_ROLE_KEY;
const siteUrl = MAESTRO_SITE_URL;
// Storage bucket the app uploads audio to (EXPO_PUBLIC_SUPABASE_BUCKET).
// Maestro env vars are globals; an unset one is a ReferenceError, hence typeof.
const storageBucket =
  typeof MAESTRO_SUPABASE_BUCKET !== 'undefined' && MAESTRO_SUPABASE_BUCKET
    ? MAESTRO_SUPABASE_BUCKET
    : 'local';

function getDefaultHeaders(extraHeaders) {
  const headers = {
    Authorization: 'Bearer ' + serviceRoleKey,
    apikey: serviceRoleKey,
    'Content-Type': 'application/json'
  };

  if (extraHeaders) {
    Object.assign(headers, extraHeaders);
  }

  return headers;
}

function getUserByEmail(email) {
  // Validate email is defined and is a non-empty string
  if (!email || typeof email !== 'string' || email.trim() === '') {
    throw new Error(
      'Email is required and must be a non-empty string. Received: ' + email
    );
  }

  console.log('Getting user by email:', email);

  const getUserResponse = http.get(
    supabaseUrl + '/auth/v1/admin/users?email=' + encodeURIComponent(email),
    { headers: getDefaultHeaders() }
  );

  console.log('Get user response status:', getUserResponse.status);
  console.log('Get user response body:', getUserResponse.body);

  const responseData = JSON.parse(getUserResponse.body);
  const users = responseData.users || responseData;

  if (!users || users.length === 0) {
    throw new Error('User not found with email: ' + email);
  }

  // Find the user that exactly matches the requested email
  const normalizedSearchEmail = email.toLowerCase().trim();
  const matchingUser = users.find(
    (u) => u.email && u.email.toLowerCase().trim() === normalizedSearchEmail
  );

  if (!matchingUser) {
    console.log('Available users:', users.map((u) => u.email).join(', '));
    throw new Error(
      'No user found with exact email match: ' +
        email +
        '. Found ' +
        users.length +
        ' user(s) but none with matching email.'
    );
  }

  console.log('Found matching user with ID:', matchingUser.id);
  return matchingUser;
}

function uniqueEmail(prefix) {
  const tag = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const safePrefix = String(prefix || 'maestro').replace(/[^a-z0-9]/gi, '');
  return safePrefix + '.' + tag + '@langquest.org';
}

function uniquePassword(prefix) {
  return (
    String(prefix || 'pw') +
    '-' +
    Date.now() +
    '-' +
    Math.random().toString(36).slice(2, 10)
  );
}

function createConfirmedUser(email, password) {
  if (!email || typeof email !== 'string' || email.trim() === '') {
    throw new Error(
      'Email is required and must be a non-empty string. Received: ' + email
    );
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    throw new Error(
      'Password is required and must be at least 6 characters. Received: ' +
        password
    );
  }

  const username =
    'maestro_' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 6);

  const userMetadata = {
    username: username,
    terms_accepted: true,
    terms_accepted_at: new Date().toISOString()
  };
  const languoidResponse = http.get(
    supabaseUrl +
      '/rest/v1/languoid?name=eq.English&ui_ready=eq.true&select=id&limit=1',
    { headers: getDefaultHeaders() }
  );
  if (languoidResponse.status === 200) {
    const languoids = JSON.parse(languoidResponse.body);
    if (languoids && languoids.length > 0) {
      userMetadata.ui_languoid_id = languoids[0].id;
    }
  }

  console.log('Creating confirmed user:', email);

  const createResponse = http.post(supabaseUrl + '/auth/v1/admin/users', {
    headers: getDefaultHeaders(),
    body: JSON.stringify({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: userMetadata
    })
  });

  console.log('Create user response status:', createResponse.status);
  console.log('Create user response body:', createResponse.body);

  if (createResponse.status !== 200) {
    throw new Error(
      'Failed to create user: ' +
        createResponse.status +
        ' ' +
        createResponse.body
    );
  }

  return JSON.parse(createResponse.body);
}

function deleteUser(email) {
  const user = getUserByEmail(email);
  console.log('Found user ID:', user.id);
  console.log('Deleting user with email:', email);

  // Delete the user by ID
  return http.delete(supabaseUrl + '/auth/v1/admin/users/' + user.id, {
    headers: getDefaultHeaders()
  });
}

function updateUserPassword(email, newPassword) {
  // Validate inputs
  if (!email || typeof email !== 'string' || email.trim() === '') {
    throw new Error(
      'Email is required and must be a non-empty string. Received: ' + email
    );
  }
  if (
    !newPassword ||
    typeof newPassword !== 'string' ||
    newPassword.length < 6
  ) {
    throw new Error(
      'Password is required and must be at least 6 characters. Received: ' +
        newPassword
    );
  }

  const user = getUserByEmail(email);
  console.log('Found user ID:', user.id);
  console.log('Updating password for user:', email);
  console.log('New password length:', newPassword.length);

  // Use Supabase Admin API to update the user's password directly
  // This bypasses the need for email verification
  const updateResponse = http.put(
    supabaseUrl + '/auth/v1/admin/users/' + user.id,
    {
      headers: getDefaultHeaders(),
      body: JSON.stringify({
        password: newPassword
      })
    }
  );

  console.log('Update password response status:', updateResponse.status);
  console.log('Update password response body:', updateResponse.body);

  if (updateResponse.status !== 200) {
    throw new Error(
      'Failed to update password: ' +
        updateResponse.status +
        ' ' +
        updateResponse.body
    );
  }

  console.log('Successfully updated password for user:', email);
  return JSON.parse(updateResponse.body);
}

function getAppScheme() {
  if (typeof MAESTRO_APP_SCHEME !== 'undefined' && MAESTRO_APP_SCHEME) {
    return String(MAESTRO_APP_SCHEME);
  }
  const appId =
    typeof MAESTRO_APP_ID !== 'undefined' && MAESTRO_APP_ID
      ? String(MAESTRO_APP_ID)
      : '';
  if (appId.indexOf('.preview') !== -1) {
    return 'langquest-preview';
  }
  if (appId.indexOf('.development') !== -1) {
    return 'langquest-dev';
  }
  return 'langquest';
}

function generatePasswordResetLink(email) {
  // Validate email is defined and is a non-empty string
  if (!email || typeof email !== 'string' || email.trim() === '') {
    throw new Error(
      'Email is required and must be a non-empty string. Received: ' + email
    );
  }

  console.log('Generating password reset link for email:', email);

  // Native route is /reset-password. /en/reset-password is the website
  // locale path and lands on Expo's unmatched "Page not found" screen.
  const finalRedirectTo = getAppScheme() + '://reset-password';

  console.log('Using redirect URL:', finalRedirectTo);

  // Use Supabase Admin API to generate a recovery link
  const generateLinkResponse = http.post(
    supabaseUrl + '/auth/v1/admin/generate_link',
    {
      headers: getDefaultHeaders(),
      body: JSON.stringify({
        type: 'recovery',
        email: email,
        redirect_to: finalRedirectTo
      })
    }
  );

  if (generateLinkResponse.status !== 200) {
    throw new Error(
      'Failed to generate password reset link: ' + generateLinkResponse.body
    );
  }

  const responseData = JSON.parse(generateLinkResponse.body);
  let resetLink =
    responseData.properties?.action_link || responseData.action_link;

  if (!resetLink) {
    throw new Error(
      'No reset link found in response: ' + generateLinkResponse.body
    );
  }

  console.log('Generated password reset link:', resetLink);
  return resetLink;
}

function sleep(ms) {
  try {
    const Thread = Java.type('java.lang.Thread');
    Thread.sleep(ms);
  } catch (error) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      // Maestro JS has no timer; spin only if Java sleep is unavailable.
    }
  }
}

function waitForRows(path, label, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 30000);
  let lastBody = '';

  while (Date.now() < deadline) {
    const response = http.get(supabaseUrl + path, {
      headers: getDefaultHeaders({ Prefer: 'return=representation' })
    });
    lastBody = response.body;

    if (response.status === 200) {
      const rows = JSON.parse(response.body);
      if (rows && rows.length > 0) {
        console.log('Found', label, rows[0].id);
        return rows[0];
      }
    }

    sleep(1000);
  }

  throw new Error(
    'Timed out waiting for ' + label + '. Last response: ' + lastBody
  );
}

function waitForProject(projectName, timeoutMs) {
  if (
    !projectName ||
    typeof projectName !== 'string' ||
    projectName.trim() === ''
  ) {
    throw new Error(
      'Project name is required and must be a non-empty string. Received: ' +
        projectName
    );
  }

  return waitForRows(
    '/rest/v1/project?name=eq.' +
      encodeURIComponent(projectName) +
      '&select=id,name',
    'project ' + projectName,
    timeoutMs
  );
}

function waitForLanguoid(languoidName, timeoutMs) {
  if (
    !languoidName ||
    typeof languoidName !== 'string' ||
    languoidName.trim() === ''
  ) {
    throw new Error(
      'Languoid name is required and must be a non-empty string. Received: ' +
        languoidName
    );
  }

  return waitForRows(
    '/rest/v1/languoid?name=eq.' +
      encodeURIComponent(languoidName) +
      '&select=id,name',
    'languoid ' + languoidName,
    timeoutMs
  );
}

function waitForQuest(questName, timeoutMs, projectId) {
  if (!questName || typeof questName !== 'string' || questName.trim() === '') {
    throw new Error(
      'Quest name is required and must be a non-empty string. Received: ' +
        questName
    );
  }

  let path = '/rest/v1/quest?name=eq.' + encodeURIComponent(questName);
  if (projectId) {
    path += '&project_id=eq.' + projectId;
  }
  path += '&select=id,name';

  return waitForRows(path, 'quest ' + questName, timeoutMs);
}

function restGet(path) {
  const response = http.get(supabaseUrl + '/rest/v1/' + path, {
    headers: getDefaultHeaders()
  });
  if (response.status !== 200) {
    throw new Error(
      'GET ' + path + ' failed: ' + response.status + ' ' + response.body
    );
  }
  return JSON.parse(response.body);
}

function restDelete(path) {
  const response = http.delete(supabaseUrl + '/rest/v1/' + path, {
    headers: getDefaultHeaders()
  });
  if (response.status !== 200 && response.status !== 204) {
    throw new Error(
      'DELETE ' + path + ' failed: ' + response.status + ' ' + response.body
    );
  }
}

function deleteProject(projectName) {
  if (
    !projectName ||
    typeof projectName !== 'string' ||
    projectName.trim() === ''
  ) {
    throw new Error(
      'Project name is required and must be a non-empty string. Received: ' +
        projectName
    );
  }

  console.log('Deleting project with name:', projectName);

  const projects = restGet(
    'project?name=eq.' + encodeURIComponent(projectName) + '&select=id'
  );
  if (!projects || projects.length === 0) {
    // iOS skips airplane-mode creates; cleanup still runs.
    console.log('deleteProject skipped, no row:', projectName);
    return;
  }

  const projectId = projects[0].id;
  console.log('Found project ID:', projectId);

  // Most children cascade from project. Only the FKs declared NO ACTION or
  // RESTRICT need removing first (checked against pg_constraint):
  //   vote.asset_id (restrict), asset_content_link.asset_id,
  //   asset.source_asset_id (translations), quest_closure.quest_id.
  const assets = restGet('asset?project_id=eq.' + projectId + '&select=id');
  const assetIds = assets.map(function (row) {
    return row.id;
  });

  // Audio objects referenced by this project's content rows. Deleting the
  // acl rows below enqueues them for grace-period deletion; remove the
  // objects and the queue rows now so failed runs do not leave orphans or
  // trip a later sweep assertion.
  let objectNames = [];
  if (assetIds.length > 0) {
    const assetsIn = 'in.(' + assetIds.join(',') + ')';
    const contents = restGet(
      'asset_content_link?asset_id=' + assetsIn + '&select=audio'
    );
    objectNames = (contents || [])
      .reduce(function (all, row) {
        return all.concat(Array.isArray(row.audio) ? row.audio : []);
      }, [])
      .filter(function (name, index, all) {
        return (
          typeof name === 'string' &&
          name.trim() !== '' &&
          name.indexOf('file://') !== 0 &&
          name.indexOf('blob:') !== 0 &&
          all.indexOf(name) === index
        );
      });

    restDelete('vote?asset_id=' + assetsIn);
    restDelete('asset_content_link?asset_id=' + assetsIn);
    restDelete(
      'asset?project_id=eq.' + projectId + '&source_asset_id=not.is.null'
    );
  }
  restDelete('quest_closure?project_id=eq.' + projectId);
  restDelete('project?id=eq.' + projectId);

  if (objectNames.length > 0) {
    deleteStorageObjects(objectNames);
    try {
      restDelete(
        'storage_object_deletion_queue?object_name=in.(' +
          objectNames
            .map(function (name) {
              return encodeURIComponent('"' + name.replace(/"/g, '\\"') + '"');
            })
            .join(',') +
          ')'
      );
    } catch (error) {
      console.log('Deletion queue cleanup skipped:', error);
    }
  }

  console.log('Successfully deleted project:', projectName);
}

function deleteUserIfExists(email) {
  try {
    return deleteUser(email);
  } catch (error) {
    console.log('deleteUserIfExists skipped:', error);
    return null;
  }
}

function randomId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function restPost(table, body) {
  const response = http.post(supabaseUrl + '/rest/v1/' + table, {
    headers: getDefaultHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(body)
  });
  if (response.status !== 201 && response.status !== 200) {
    throw new Error(
      'POST ' + table + ' failed: ' + response.status + ' ' + response.body
    );
  }
  const rows = JSON.parse(response.body);
  return Array.isArray(rows) ? rows[0] : rows;
}

function restPatch(path, body) {
  const url = supabaseUrl + '/rest/v1/' + path;
  const payload = JSON.stringify(body);
  const headers = getDefaultHeaders({ Prefer: 'return=representation' });
  const response = http.request(url, {
    method: 'PATCH',
    headers: headers,
    body: payload
  });
  if (!response || (response.status !== 200 && response.status !== 204)) {
    throw new Error(
      'PATCH ' +
        path +
        ' failed: ' +
        (response ? response.status + ' ' + response.body : 'empty response')
    );
  }
  if (!response.body) return null;
  const rows = JSON.parse(response.body);
  return Array.isArray(rows) ? rows[0] : rows;
}

function seedProject(name, creatorEmail, isPrivate, template) {
  if (!name || !creatorEmail) {
    throw new Error('seedProject requires name and creatorEmail');
  }
  const allowed = { unstructured: true, bible: true, fia: true };
  const projectTemplate =
    template && allowed[template] ? template : 'unstructured';
  const user = getUserByEmail(creatorEmail);
  const projectId = randomId();
  const now = new Date().toISOString();
  restPost('project', {
    id: projectId,
    name: name,
    private: isPrivate === true || isPrivate === 'true',
    visible: true,
    creator_id: user.id,
    created_at: now,
    last_updated: now,
    active: true,
    template: projectTemplate
  });
  restPost('profile_project_link', {
    profile_id: user.id,
    project_id: projectId,
    membership: 'owner',
    active: true,
    created_at: now,
    last_updated: now
  });
  console.log('Seeded project', name, projectId, projectTemplate);
  return { id: projectId, name: name, template: projectTemplate };
}

// Seeded quests are cloud-only on the device (members opening one see
// Download Required; non-members open the cloud assets) unless
// downloadForCreator is set, which puts the creator in download_profiles so
// PowerSync replicates the quest as if downloaded.
function seedQuest(
  projectName,
  questName,
  creatorEmail,
  published,
  downloadForCreator
) {
  if (!projectName || !questName || !creatorEmail) {
    throw new Error(
      'seedQuest requires projectName, questName, and creatorEmail'
    );
  }
  const project = waitForProject(projectName);
  const user = getUserByEmail(creatorEmail);
  const questId = randomId();
  const now = new Date().toISOString();
  const isPublished = published === true || published === 'true';
  const downloaded =
    downloadForCreator === true || downloadForCreator === 'true';
  const row = {
    id: questId,
    name: questName,
    project_id: project.id,
    creator_id: user.id,
    created_at: now,
    last_updated: now,
    active: true,
    visible: true,
    // Others only see quests with published_at set.
    published_at: isPublished ? now : null
  };
  if (downloaded) row.download_profiles = [user.id];
  restPost('quest', row);
  console.log(
    'Seeded quest',
    questName,
    questId,
    isPublished ? 'published' : 'draft',
    downloaded ? 'downloaded' : 'cloud-only'
  );
  return { id: questId, name: questName };
}

function seedBibleHierarchy(projectName, creatorEmail) {
  if (!projectName || !creatorEmail) {
    throw new Error('seedBibleHierarchy requires projectName and creatorEmail');
  }
  const project = waitForProject(projectName);
  const user = getUserByEmail(creatorEmail);
  const now = new Date().toISOString();
  const downloadProfiles = [user.id];
  const bookId = randomId();
  const chapterId = randomId();
  restPost('quest', {
    id: bookId,
    name: 'Genesis',
    project_id: project.id,
    parent_id: null,
    creator_id: user.id,
    created_at: now,
    last_updated: now,
    active: true,
    visible: true,
    published_at: now,
    download_profiles: downloadProfiles,
    metadata: JSON.stringify({ bible: { book: 'gen' } })
  });
  restPost('quest', {
    id: chapterId,
    name: 'Genesis 1',
    project_id: project.id,
    parent_id: bookId,
    creator_id: user.id,
    created_at: now,
    last_updated: now,
    active: true,
    visible: true,
    published_at: now,
    download_profiles: downloadProfiles,
    metadata: JSON.stringify({
      bible: { book: 'gen', chapter: 1 },
      allowImportAssets: true
    })
  });
  console.log('Seeded bible hierarchy Genesis / Genesis 1', bookId, chapterId);
  return {
    bookId: bookId,
    chapterId: chapterId,
    bookName: 'Genesis',
    chapterName: 'Genesis 1'
  };
}

function seedSourceAsset(
  projectName,
  questName,
  creatorEmail,
  assetName,
  text
) {
  if (!projectName || !questName || !creatorEmail || !assetName) {
    throw new Error(
      'seedSourceAsset requires projectName, questName, creatorEmail, and assetName'
    );
  }
  const project = waitForProject(projectName);
  const quest = waitForQuest(questName, 30000, project.id);
  const user = getUserByEmail(creatorEmail);
  const assetId = randomId();
  const now = new Date().toISOString();
  // PowerSync only replicates rows whose download_profiles contains the
  // user. Skipping this leaves the asset visible via REST (the list) but
  // strips asset_content_link on checkpoint, so detail/translate show
  // "(No text)". The ACL insert trigger also copies this array onto any
  // translation the app later uploads.
  const downloadProfiles = [user.id];
  restPost('asset', {
    id: assetId,
    name: assetName,
    project_id: project.id,
    creator_id: user.id,
    content_type: 'source',
    download_profiles: downloadProfiles,
    created_at: now,
    last_updated: now,
    active: true,
    visible: true
  });
  restPost('quest_asset_link', {
    quest_id: quest.id,
    asset_id: assetId,
    name: assetName,
    download_profiles: downloadProfiles,
    created_at: now,
    last_updated: now,
    active: true,
    visible: true
  });
  if (text) {
    restPost('asset_content_link', {
      id: randomId(),
      asset_id: assetId,
      text: text,
      download_profiles: downloadProfiles,
      created_at: now,
      last_updated: now,
      active: true
    });
  }
  console.log('Seeded source asset', assetName, assetId);
  return { id: assetId, name: assetName };
}

// Source asset whose content row points at a real storage object, so the
// downloader on the device has bytes to fetch. The object is uploaded first;
// the acl BEFORE INSERT trigger then stamps audio_uploaded_at, which is what
// AudioDownloader keys off. Returns { id, name, objectName }.
function seedAudioAsset(projectName, questName, creatorEmail, assetName, text) {
  if (!projectName || !questName || !creatorEmail || !assetName) {
    throw new Error(
      'seedAudioAsset requires projectName, questName, creatorEmail, and assetName'
    );
  }
  const project = waitForProject(projectName);
  const quest = waitForQuest(questName, 30000, project.id);
  const user = getUserByEmail(creatorEmail);
  const assetId = randomId();
  const objectName = randomId() + '.wav';
  const now = new Date().toISOString();
  const downloadProfiles = [user.id];

  uploadStorageObject(objectName, buildAsciiSafeWav(), 'audio/wav');
  waitForStorageObject(objectName, 15000);

  restPost('asset', {
    id: assetId,
    name: assetName,
    project_id: project.id,
    creator_id: user.id,
    content_type: 'source',
    download_profiles: downloadProfiles,
    created_at: now,
    last_updated: now,
    active: true,
    visible: true
  });
  restPost('quest_asset_link', {
    quest_id: quest.id,
    asset_id: assetId,
    name: assetName,
    download_profiles: downloadProfiles,
    created_at: now,
    last_updated: now,
    active: true,
    visible: true
  });
  const content = restPost('asset_content_link', {
    id: randomId(),
    asset_id: assetId,
    text: text || null,
    audio: [objectName],
    download_profiles: downloadProfiles,
    created_at: now,
    last_updated: now,
    active: true
  });
  if (!content || !content.audio_uploaded_at) {
    throw new Error(
      'seedAudioAsset: audio_uploaded_at was not stamped for ' +
        objectName +
        '. Is trigger_set_acl_audio_uploaded_at installed?'
    );
  }
  console.log('Seeded audio asset', assetName, assetId, objectName);
  return { id: assetId, name: assetName, objectName: objectName };
}

// Add an existing asset to a second quest in the same project (shared
// source). Used to show that quest-scoped visibility/active settings only
// touch one quest_asset_link.
function linkAssetToQuest(assetName, questName, creatorEmail) {
  if (!assetName || !questName || !creatorEmail) {
    throw new Error(
      'linkAssetToQuest requires assetName, questName, and creatorEmail'
    );
  }
  const asset = waitForAsset(assetName);
  const assets = restGet(
    'asset?id=eq.' + asset.id + '&select=id,project_id,download_profiles'
  );
  const projectId = assets[0].project_id;
  const quests = restGet(
    'quest?name=eq.' +
      encodeURIComponent(questName) +
      '&project_id=eq.' +
      projectId +
      '&select=id'
  );
  if (!quests || quests.length === 0) {
    throw new Error(
      'linkAssetToQuest: quest ' +
        questName +
        ' not found in project ' +
        projectId
    );
  }
  const user = getUserByEmail(creatorEmail);
  const now = new Date().toISOString();
  const downloadProfiles = []
    .concat(assets[0].download_profiles || [], [user.id])
    .filter(function (id, index, all) {
      return id && all.indexOf(id) === index;
    });
  const row = restPost('quest_asset_link', {
    quest_id: quests[0].id,
    asset_id: asset.id,
    name: assetName,
    download_profiles: downloadProfiles,
    created_at: now,
    last_updated: now,
    active: true,
    visible: true
  });
  console.log('Linked asset', assetName, 'to quest', questName);
  return row;
}

function waitForAsset(assetName, timeoutMs) {
  if (!assetName || typeof assetName !== 'string' || assetName.trim() === '') {
    throw new Error(
      'Asset name is required and must be a non-empty string. Received: ' +
        assetName
    );
  }
  return waitForRows(
    '/rest/v1/asset?name=eq.' +
      encodeURIComponent(assetName) +
      '&select=id,name',
    'asset ' + assetName,
    timeoutMs
  );
}

// Content rows for an asset. Offload of a published quest that shares the
// asset with a draft must leave these rows (and their audio[]) on the server.
function waitForAssetContent(assetName, timeoutMs) {
  if (!assetName || typeof assetName !== 'string' || assetName.trim() === '') {
    throw new Error(
      'waitForAssetContent requires assetName. Received: ' + assetName
    );
  }
  const asset = waitForAsset(assetName, timeoutMs);
  return waitForRows(
    '/rest/v1/asset_content_link?asset_id=eq.' +
      asset.id +
      '&select=id,asset_id,audio,audio_uploaded_at',
    'asset_content_link for ' + assetName,
    timeoutMs
  );
}

// Seeded source assets are not provenance=created, so rename writes
// quest_asset_link.name only. asset.name stays the seed name.
function waitForQuestAssetName(questName, assetName, timeoutMs) {
  if (!questName || !assetName) {
    throw new Error(
      'waitForQuestAssetName requires questName and assetName. Received: ' +
        questName +
        ', ' +
        assetName
    );
  }
  const quest = waitForQuest(questName, timeoutMs);
  return waitForRows(
    '/rest/v1/quest_asset_link?quest_id=eq.' +
      quest.id +
      '&name=eq.' +
      encodeURIComponent(assetName) +
      '&select=asset_id,name',
    'quest asset ' + assetName,
    timeoutMs
  );
}

function hasAudioValue(row) {
  return (
    row &&
    Array.isArray(row.audio) &&
    row.audio.some(function (value) {
      return typeof value === 'string' && value.trim() !== '';
    })
  );
}

// Recorded takes are named 001, 002, … by the recording screen. Returns the
// asset_content_link rows (with audio) for those takes, optionally narrowed
// to one take name and/or to rows the server has confirmed uploaded.
function findRecordedContent(questId, assetName, requireUploaded) {
  const linksResponse = http.get(
    supabaseUrl +
      '/rest/v1/quest_asset_link?quest_id=eq.' +
      questId +
      '&select=asset_id,name',
    { headers: getDefaultHeaders({ Prefer: 'return=representation' }) }
  );
  const links =
    linksResponse.status === 200 ? JSON.parse(linksResponse.body) : [];
  const recorded = (links || []).filter(function (row) {
    if (!row || !row.name) return false;
    if (assetName) return String(row.name) === String(assetName);
    return /^\d{3}$/.test(String(row.name));
  });
  if (recorded.length === 0) {
    return { rows: [], lastBody: linksResponse.body };
  }

  const ids = recorded
    .map(function (row) {
      return row.asset_id;
    })
    .join(',');
  const contentResponse = http.get(
    supabaseUrl +
      '/rest/v1/asset_content_link?asset_id=in.(' +
      ids +
      ')&select=id,asset_id,audio,text,audio_uploaded_at&order=created_at.asc',
    { headers: getDefaultHeaders({ Prefer: 'return=representation' }) }
  );
  const contents =
    contentResponse.status === 200 ? JSON.parse(contentResponse.body) : [];
  const rows = (contents || []).filter(function (row) {
    if (!hasAudioValue(row)) return false;
    if (requireUploaded && !row.audio_uploaded_at) return false;
    return true;
  });
  return { rows: rows, lastBody: contentResponse.body };
}

function waitForRecordedContent(
  questName,
  timeoutMs,
  assetName,
  requireUploaded
) {
  if (!questName || typeof questName !== 'string' || questName.trim() === '') {
    throw new Error(
      'waitForRecordedAudio requires questName. Received: ' + questName
    );
  }
  const quest = waitForQuest(questName, timeoutMs);
  const deadline = Date.now() + (timeoutMs || 45000);
  let lastBody = '';

  while (Date.now() < deadline) {
    const found = findRecordedContent(quest.id, assetName, requireUploaded);
    lastBody = found.lastBody;
    if (found.rows.length > 0) {
      const row = found.rows[0];
      console.log(
        requireUploaded ? 'Found uploaded audio' : 'Found recorded audio',
        row.id,
        row.audio[0],
        row.audio_uploaded_at || '(not confirmed)'
      );
      return row;
    }
    sleep(1000);
  }

  throw new Error(
    'Timed out waiting for ' +
      (requireUploaded ? 'uploaded' : 'recorded') +
      ' audio on ' +
      questName +
      (assetName ? ' / ' + assetName : '') +
      '. Last response: ' +
      lastBody
  );
}

// Third argument narrows to one take (e.g. "002"); default is any 001-style take.
function waitForRecordedAudio(questName, timeoutMs, assetName) {
  return waitForRecordedContent(questName, timeoutMs, assetName, false);
}

// Same, but only returns once the server stamped audio_uploaded_at — i.e.
// the storage object exists. This is the "upload at record time" contract.
function waitForAudioUploaded(questName, timeoutMs, assetName) {
  return waitForRecordedContent(questName, timeoutMs, assetName, true);
}

// audio[] values are bare storage object names ("{uuid}.{ext}") since the
// client attachment directory was flattened. Legacy `local/` prefixes and
// file:// / blob: URIs must never reach the server from a current client.
function assertFlatObjectName(objectName) {
  if (typeof objectName !== 'string' || objectName.trim() === '') {
    throw new Error('Expected an audio object name, got: ' + objectName);
  }
  if (
    /^(local\/|file:|blob:|https?:)/.test(objectName) ||
    objectName.indexOf('/') !== -1
  ) {
    throw new Error('audio[] value is not a flat object name: ' + objectName);
  }
  if (!/^[0-9a-f-]{36}\.[a-z0-9]+$/i.test(objectName)) {
    throw new Error('audio[] value is not "{uuid}.{ext}": ' + objectName);
  }
  console.log('Flat object name OK', objectName);
  return objectName;
}

// evalScript bodies stay single expressions; use this instead of inline if/throw.
function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      (label || 'assertEqual') +
        ': expected ' +
        JSON.stringify(expected) +
        ' but got ' +
        JSON.stringify(actual)
    );
  }
  console.log((label || 'assertEqual') + ' OK', JSON.stringify(actual));
  return true;
}

function assertNotEqual(actual, unexpected, label) {
  if (actual === unexpected) {
    throw new Error(
      (label || 'assertNotEqual') + ': value still ' + JSON.stringify(actual)
    );
  }
  console.log((label || 'assertNotEqual') + ' OK', JSON.stringify(actual));
  return true;
}

// The rename drawer's controlled TextInput takes a single ADB keystroke
// reliably, but where Android puts the caret varies, so flows type one
// character and read the field back (copyTextFrom). Check that the result
// is the original name with exactly that character inserted somewhere.
function assertInsertedOnce(typed, original, inserted, label) {
  const name = label || 'assertInsertedOnce';
  if (typeof typed !== 'string' || typed.length !== original.length + 1) {
    throw new Error(
      name +
        ': expected ' +
        JSON.stringify(original) +
        ' plus one ' +
        JSON.stringify(inserted) +
        ' but the field shows ' +
        JSON.stringify(typed)
    );
  }
  let found = false;
  for (let i = 0; i < typed.length; i++) {
    if (
      typed[i] === inserted &&
      typed.slice(0, i) + typed.slice(i + 1) === original
    ) {
      found = true;
      break;
    }
  }
  if (!found) {
    throw new Error(
      name +
        ': ' +
        JSON.stringify(typed) +
        ' is not ' +
        JSON.stringify(original) +
        ' with one ' +
        JSON.stringify(inserted) +
        ' inserted'
    );
  }
  console.log(name + ' OK', JSON.stringify(typed));
  return typed;
}

function waitForQuestPublished(questName, timeoutMs) {
  if (!questName || typeof questName !== 'string' || questName.trim() === '') {
    throw new Error(
      'waitForQuestPublished requires questName. Received: ' + questName
    );
  }
  return waitForRows(
    '/rest/v1/quest?name=eq.' +
      encodeURIComponent(questName) +
      '&published_at=not.is.null&select=id,name,published_at',
    'published quest ' + questName,
    timeoutMs
  );
}

// Total audio[] entries across every asset_content_link row of the quest
// asset(s) with that name. Merge copies audio into new rows, so a merged
// take reports the sum of its parts.
function waitForAudioCount(questName, assetName, expectedCount, timeoutMs) {
  if (!questName || !assetName) {
    throw new Error('waitForAudioCount requires questName and assetName');
  }
  const expected = Number(expectedCount);
  const quest = waitForQuest(questName, timeoutMs);
  const deadline = Date.now() + (timeoutMs || 45000);
  let lastCount = -1;
  let lastBody = '';

  while (Date.now() < deadline) {
    const found = findRecordedContent(quest.id, assetName, false);
    lastBody = found.lastBody;
    lastCount = found.rows.reduce(function (sum, row) {
      return (
        sum +
        row.audio.filter(function (value) {
          return typeof value === 'string' && value.trim() !== '';
        }).length
      );
    }, 0);
    if (lastCount === expected) {
      console.log('Audio count for', assetName, 'is', lastCount);
      return found.rows;
    }
    sleep(1000);
  }

  throw new Error(
    'Timed out waiting for ' +
      assetName +
      ' on ' +
      questName +
      ' to have ' +
      expected +
      ' audio entries (last ' +
      lastCount +
      '). Last response: ' +
      lastBody
  );
}

// quest_asset_link names in order_index order. Pass the expected names as an
// array; the wait ends when the server order equals it exactly.
function waitForQuestAssetOrder(questName, expectedNames, timeoutMs) {
  if (!questName || !Array.isArray(expectedNames)) {
    throw new Error(
      'waitForQuestAssetOrder requires questName and an array of names'
    );
  }
  const quest = waitForQuest(questName, timeoutMs);
  const deadline = Date.now() + (timeoutMs || 30000);
  const expected = expectedNames.map(String).join('|');
  let lastOrder = '';

  while (Date.now() < deadline) {
    const links = restGet(
      'quest_asset_link?quest_id=eq.' +
        quest.id +
        '&select=name,order_index&order=order_index.asc.nullslast,created_at.asc'
    );
    lastOrder = (links || [])
      .map(function (row) {
        return String(row.name);
      })
      .join('|');
    if (lastOrder === expected) {
      console.log('Quest asset order matches', expected);
      return links;
    }
    sleep(1000);
  }

  throw new Error(
    'Timed out waiting for quest ' +
      questName +
      ' asset order ' +
      expected +
      '. Last order: ' +
      lastOrder
  );
}

// ----------------------------------------------------------------------------
// Storage objects + deletion queue
// ----------------------------------------------------------------------------

function storageObjectUrl(objectName) {
  return (
    supabaseUrl +
    '/storage/v1/object/' +
    storageBucket +
    '/' +
    encodeURIComponent(objectName)
  );
}

// Exact-name lookup via the list endpoint (`search` is a substring filter,
// so filter the result again). Names live at the bucket root.
function listStorageObjects(objectName) {
  const response = http.post(
    supabaseUrl + '/storage/v1/object/list/' + storageBucket,
    {
      headers: getDefaultHeaders(),
      body: JSON.stringify({
        prefix: '',
        search: objectName,
        limit: 50,
        offset: 0
      })
    }
  );
  if (response.status !== 200) {
    throw new Error(
      'Storage list failed: ' + response.status + ' ' + response.body
    );
  }
  const rows = JSON.parse(response.body);
  return (rows || []).filter(function (row) {
    return row && row.name === objectName;
  });
}

function storageObjectExists(objectName) {
  if (!objectName || typeof objectName !== 'string') {
    throw new Error('storageObjectExists requires objectName');
  }
  return listStorageObjects(objectName).length > 0;
}

function waitForStorageObject(objectName, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 45000);
  while (Date.now() < deadline) {
    if (storageObjectExists(objectName)) {
      console.log('Storage object present', storageBucket + '/' + objectName);
      return true;
    }
    sleep(1000);
  }
  throw new Error(
    'Timed out waiting for storage object ' + storageBucket + '/' + objectName
  );
}

function waitForStorageObjectGone(objectName, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 45000);
  while (Date.now() < deadline) {
    if (!storageObjectExists(objectName)) {
      console.log('Storage object gone', storageBucket + '/' + objectName);
      return true;
    }
    sleep(1000);
  }
  throw new Error(
    'Timed out waiting for storage object ' +
      storageBucket +
      '/' +
      objectName +
      ' to be deleted'
  );
}

// Maestro's http client sends string bodies as UTF-8 and has no binary or
// multipart mode, so the fixture is a WAV whose every byte is < 0x80: 8-bit
// PCM, mono, 8 kHz, 1 s at 0x7f (one step off true silence, which is 0x80).
// Sizes are fixed so the little-endian length fields stay ASCII too.
function buildAsciiSafeWav() {
  const sampleRate = 8000;
  const samples = 8000; // 0x1F40 — both bytes < 0x80
  const bytes = [];
  function pushAscii(str) {
    for (let i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i));
  }
  function pushU32(value) {
    bytes.push(
      value & 0xff,
      (value >> 8) & 0xff,
      (value >> 16) & 0xff,
      (value >>> 24) & 0xff
    );
  }
  function pushU16(value) {
    bytes.push(value & 0xff, (value >> 8) & 0xff);
  }
  pushAscii('RIFF');
  pushU32(36 + samples);
  pushAscii('WAVE');
  pushAscii('fmt ');
  pushU32(16);
  pushU16(1); // PCM
  pushU16(1); // mono
  pushU32(sampleRate);
  pushU32(sampleRate); // byte rate (8-bit mono)
  pushU16(1); // block align
  pushU16(8); // bits per sample
  pushAscii('data');
  pushU32(samples);
  for (let i = 0; i < samples; i++) bytes.push(0x7f);

  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] > 0x7f) {
      throw new Error('WAV fixture byte ' + i + ' is not ASCII: ' + bytes[i]);
    }
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

function uploadStorageObject(objectName, body, contentType) {
  const response = http.post(storageObjectUrl(objectName), {
    headers: getDefaultHeaders({
      'Content-Type': contentType || 'audio/wav',
      'x-upsert': 'true'
    }),
    body: body
  });
  if (response.status !== 200) {
    throw new Error(
      'Storage upload of ' +
        objectName +
        ' failed: ' +
        response.status +
        ' ' +
        response.body
    );
  }
  console.log('Uploaded storage object', storageBucket + '/' + objectName);
  return JSON.parse(response.body);
}

function deleteStorageObjects(objectNames) {
  const names = (objectNames || []).filter(function (name) {
    return typeof name === 'string' && name.trim() !== '';
  });
  if (names.length === 0) return;
  const response = http.request(
    supabaseUrl + '/storage/v1/object/' + storageBucket,
    {
      method: 'DELETE',
      headers: getDefaultHeaders(),
      body: JSON.stringify({ prefixes: names })
    }
  );
  if (!response || response.status !== 200) {
    console.log(
      'deleteStorageObjects skipped:',
      response ? response.status + ' ' + response.body : 'empty response'
    );
    return;
  }
  console.log('Deleted storage objects', names.join(', '));
}

// Server-only table (RLS on, no client policies); the service role reads it.
function getDeletionQueueRow(objectName) {
  const rows = restGet(
    'storage_object_deletion_queue?object_name=eq.' +
      encodeURIComponent(objectName) +
      '&select=object_name,requested_at,eligible_at,attempts,last_error'
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

// Set when the acl row that referenced the object is deleted (or its audio[]
// changes) on the server. eligible_at is ~24h out — the grace period.
function waitForDeletionQueued(objectName, timeoutMs) {
  if (!objectName || typeof objectName !== 'string') {
    throw new Error('waitForDeletionQueued requires objectName');
  }
  const deadline = Date.now() + (timeoutMs || 45000);
  while (Date.now() < deadline) {
    const row = getDeletionQueueRow(objectName);
    if (row) {
      const graceMs = new Date(row.eligible_at) - new Date(row.requested_at);
      if (graceMs < 23 * 60 * 60 * 1000) {
        throw new Error(
          'Deletion queue row for ' +
            objectName +
            ' has a grace period of ' +
            Math.round(graceMs / 60000) +
            ' min; expected ~24h'
        );
      }
      console.log('Deletion queued', objectName, 'eligible', row.eligible_at);
      return row;
    }
    sleep(1000);
  }
  throw new Error(
    'Timed out waiting for ' + objectName + ' in storage_object_deletion_queue'
  );
}

function waitForDeletionNotQueued(objectName, settleMs) {
  if (!objectName || typeof objectName !== 'string') {
    throw new Error('waitForDeletionNotQueued requires objectName');
  }
  // Give the client sync + trigger a moment to (wrongly) enqueue, then check.
  sleep(settleMs || 5000);
  const row = getDeletionQueueRow(objectName);
  if (row) {
    throw new Error(
      objectName + ' was queued for deletion but is still referenced'
    );
  }
  console.log('Deletion not queued for', objectName);
  return true;
}

// Skip the 24h grace period for one object and run the processor now.
// Returns the processor's action for that object: kept_referenced, done,
// delete_requested, or skipped_unconfigured (vault secrets missing locally).
function runStorageDeletionSweep(objectName) {
  if (!objectName || typeof objectName !== 'string') {
    throw new Error('runStorageDeletionSweep requires objectName');
  }
  restPatch(
    'storage_object_deletion_queue?object_name=eq.' +
      encodeURIComponent(objectName),
    { eligible_at: '2000-01-01T00:00:00Z', attempts: 0 }
  );
  const response = http.post(
    supabaseUrl + '/rest/v1/rpc/process_storage_object_deletions',
    {
      headers: getDefaultHeaders(),
      body: JSON.stringify({ p_limit: 500 })
    }
  );
  if (response.status !== 200) {
    throw new Error(
      'process_storage_object_deletions failed: ' +
        response.status +
        ' ' +
        response.body
    );
  }
  const rows = JSON.parse(response.body) || [];
  const match = rows.find(function (row) {
    return row && row.object_name === objectName;
  });
  const action = match ? match.action : 'not_processed';
  console.log('Deletion sweep', objectName, '→', action);
  return action;
}

function expectSweepAction(objectName, expectedCsv) {
  const action = runStorageDeletionSweep(objectName);
  const allowed = String(expectedCsv)
    .split(',')
    .map(function (value) {
      return value.trim();
    });
  if (allowed.indexOf(action) === -1) {
    throw new Error(
      'Expected sweep of ' +
        objectName +
        ' to be one of ' +
        allowed.join('/') +
        ' but got ' +
        action
    );
  }
  return action;
}

// Storage-side outcome of a delete_requested sweep. pg_net is fire-and-forget,
// so poll the bucket. skipped_unconfigured means the local vault lacks
// supabase_url / supabase_service_role_key; fail with a pointer to that.
function waitForSweptObjectGone(objectName, timeoutMs) {
  const action = runStorageDeletionSweep(objectName);
  if (action === 'skipped_unconfigured') {
    throw new Error(
      'process_storage_object_deletions skipped ' +
        objectName +
        ': vault secrets supabase_url / supabase_service_role_key are missing on this database'
    );
  }
  if (action === 'kept_referenced') {
    throw new Error(
      objectName + ' is still referenced by an asset_content_link row'
    );
  }
  if (action !== 'delete_requested' && action !== 'done') {
    throw new Error(
      'Unexpected sweep action for ' + objectName + ': ' + action
    );
  }
  if (action === 'done') {
    return waitForStorageObjectGone(objectName, timeoutMs);
  }

  // pg_net is async and the processor only records the HTTP outcome of an
  // attempt on its next pass. Poll briefly; if the object is still there,
  // sweep again so last_error is populated and fail with Storage's reply
  // (a 403 means the vault's service role key is not accepted by Storage).
  const total = timeoutMs || 60000;
  const firstWait = Math.min(15000, total);
  const deadline = Date.now() + firstWait;
  while (Date.now() < deadline) {
    if (!storageObjectExists(objectName)) {
      console.log('Storage object gone', storageBucket + '/' + objectName);
      return true;
    }
    sleep(1000);
  }
  runStorageDeletionSweep(objectName);
  const row = getDeletionQueueRow(objectName);
  if (row && row.last_error) {
    throw new Error(
      'Storage refused to delete ' +
        objectName +
        ' (' +
        row.last_error +
        '). Check the vault supabase_url / supabase_service_role_key on this database.'
    );
  }
  return waitForStorageObjectGone(
    objectName,
    Math.max(5000, total - firstWait)
  );
}

// Remove tracked objects and their queue rows regardless of DB state. Use at
// the end of flows that hold object names: deleteProject only finds names
// still referenced by content rows, and garbage collection may already have
// removed those.
function cleanupStorageObjects(objectNames) {
  const names = (objectNames || []).filter(function (name) {
    return typeof name === 'string' && name.trim() !== '';
  });
  if (names.length === 0) return;
  deleteStorageObjects(names);
  try {
    restDelete(
      'storage_object_deletion_queue?object_name=in.(' +
        names
          .map(function (name) {
            return encodeURIComponent('"' + name.replace(/"/g, '\\"') + '"');
          })
          .join(',') +
        ')'
    );
  } catch (error) {
    console.log('Deletion queue cleanup skipped:', error);
  }
}

function waitForNoRecordedAudio(questName, timeoutMs) {
  if (!questName || typeof questName !== 'string' || questName.trim() === '') {
    throw new Error(
      'waitForNoRecordedAudio requires questName. Received: ' + questName
    );
  }
  const quest = waitForQuest(questName, timeoutMs);
  const deadline = Date.now() + (timeoutMs || 30000);
  let lastBody = '';

  while (Date.now() < deadline) {
    const linksResponse = http.get(
      supabaseUrl +
        '/rest/v1/quest_asset_link?quest_id=eq.' +
        quest.id +
        '&select=asset_id,name',
      { headers: getDefaultHeaders({ Prefer: 'return=representation' }) }
    );
    lastBody = linksResponse.body;
    const links =
      linksResponse.status === 200 ? JSON.parse(linksResponse.body) : [];
    const recorded = (links || []).filter(function (row) {
      return row && row.name && /^\d{3}$/.test(String(row.name));
    });
    if (recorded.length === 0) {
      console.log('Recorded audio gone for', questName);
      return true;
    }
    sleep(1000);
  }

  throw new Error(
    'Timed out waiting for recorded audio removal on ' +
      questName +
      '. Last response: ' +
      lastBody
  );
}

function waitForAssetVisible(assetName, visible, timeoutMs) {
  if (!assetName || typeof assetName !== 'string' || assetName.trim() === '') {
    throw new Error(
      'waitForAssetVisible requires assetName. Received: ' + assetName
    );
  }
  const flag = visible === false || visible === 'false' ? 'false' : 'true';
  return waitForRows(
    '/rest/v1/asset?name=eq.' +
      encodeURIComponent(assetName) +
      '&visible=eq.' +
      flag +
      '&select=id,name,visible',
    'asset ' + assetName + ' visible=' + flag,
    timeoutMs
  );
}

function waitForAssetActive(assetName, active, timeoutMs) {
  if (!assetName || typeof assetName !== 'string' || assetName.trim() === '') {
    throw new Error(
      'waitForAssetActive requires assetName. Received: ' + assetName
    );
  }
  const flag = active === false || active === 'false' ? 'false' : 'true';
  return waitForRows(
    '/rest/v1/asset?name=eq.' +
      encodeURIComponent(assetName) +
      '&active=eq.' +
      flag +
      '&select=id,name,active',
    'asset ' + assetName + ' active=' + flag,
    timeoutMs
  );
}

// quest_asset_link.visible / .active for one asset in one quest. `field` is
// "visible" or "active"; `value` is true/false.
function waitForQuestAssetLinkState(
  questName,
  assetName,
  field,
  value,
  timeoutMs
) {
  if (!questName || !assetName || (field !== 'visible' && field !== 'active')) {
    throw new Error(
      'waitForQuestAssetLinkState requires questName, assetName, and field visible|active'
    );
  }
  const flag = value === false || value === 'false' ? 'false' : 'true';
  const quest = waitForQuest(questName, timeoutMs);
  return waitForRows(
    '/rest/v1/quest_asset_link?quest_id=eq.' +
      quest.id +
      '&name=eq.' +
      encodeURIComponent(assetName) +
      '&' +
      field +
      '=eq.' +
      flag +
      '&select=asset_id,name,visible,active',
    'quest asset ' + assetName + ' ' + field + '=' + flag,
    timeoutMs
  );
}

function seedTranslation(sourceAssetName, creatorEmail, text, translationName) {
  if (!sourceAssetName || !creatorEmail || !text) {
    throw new Error(
      'seedTranslation requires sourceAssetName, creatorEmail, and text'
    );
  }
  const source = waitForAsset(sourceAssetName);
  const user = getUserByEmail(creatorEmail);
  // Mirror what NextGenNewTranslationModal writes: asset + content link +
  // quest_asset_link on the same quest as the source, in the project's
  // target language. Missing links keep the row out of PowerSync sync.
  const sourceAssets = restGet(
    'asset?id=eq.' + source.id + '&select=id,project_id'
  );
  const projectId = sourceAssets[0].project_id;
  const questLinks = restGet(
    'quest_asset_link?asset_id=eq.' + source.id + '&select=quest_id'
  );
  const targetLangs = restGet(
    'project_language_link?project_id=eq.' +
      projectId +
      '&language_type=eq.target&select=languoid_id'
  );
  const assetId = randomId();
  const now = new Date().toISOString();
  const name = translationName || sourceAssetName + '-translation';
  const sourceProfiles = restGet(
    'asset?id=eq.' + source.id + '&select=download_profiles,creator_id'
  );
  const downloadProfiles = []
    .concat(
      (sourceProfiles[0] && sourceProfiles[0].download_profiles) || [],
      sourceProfiles[0] && sourceProfiles[0].creator_id
        ? [sourceProfiles[0].creator_id]
        : [],
      [user.id]
    )
    .filter(function (id, index, all) {
      return id && all.indexOf(id) === index;
    });
  restPost('asset', {
    id: assetId,
    name: name,
    project_id: projectId,
    creator_id: user.id,
    content_type: 'translation',
    source_asset_id: source.id,
    source_language_id: targetLangs[0] ? targetLangs[0].languoid_id : null,
    download_profiles: downloadProfiles,
    order_index: 0,
    created_at: now,
    last_updated: now,
    active: true,
    visible: true
  });
  restPost('asset_content_link', {
    id: randomId(),
    asset_id: assetId,
    text: text,
    source_language_id: targetLangs[0] ? targetLangs[0].languoid_id : null,
    download_profiles: downloadProfiles,
    order_index: 0,
    created_at: now,
    last_updated: now,
    active: true
  });
  if (questLinks[0]) {
    restPost('quest_asset_link', {
      quest_id: questLinks[0].quest_id,
      asset_id: assetId,
      name: name,
      download_profiles: downloadProfiles,
      order_index: 0,
      created_at: now,
      last_updated: now,
      active: true,
      visible: true
    });
  }
  console.log('Seeded translation', name, assetId);
  return { id: assetId, name: name };
}

function seedInvite(projectName, senderEmail, receiverEmail, asOwner) {
  if (!projectName || !senderEmail || !receiverEmail) {
    throw new Error(
      'seedInvite requires projectName, senderEmail, and receiverEmail'
    );
  }
  const project = waitForProject(projectName);
  const sender = getUserByEmail(senderEmail);
  const now = new Date().toISOString();
  const row = restPost('invite', {
    id: randomId(),
    sender_profile_id: sender.id,
    email: receiverEmail,
    project_id: project.id,
    status: 'pending',
    as_owner: asOwner === true || asOwner === 'true',
    count: 1,
    active: true,
    created_at: now,
    last_updated: now
  });
  console.log('Seeded invite', receiverEmail, row && row.id);
  return row;
}

function seedRequest(projectName, senderEmail) {
  if (!projectName || !senderEmail) {
    throw new Error('seedRequest requires projectName and senderEmail');
  }
  const project = waitForProject(projectName);
  const sender = getUserByEmail(senderEmail);
  const now = new Date().toISOString();
  const row = restPost('request', {
    id: randomId(),
    sender_profile_id: sender.id,
    project_id: project.id,
    status: 'pending',
    count: 1,
    active: true,
    created_at: now,
    last_updated: now
  });
  console.log('Seeded request', senderEmail, row && row.id);
  return row;
}

function waitForInvite(projectName, email, status, timeoutMs) {
  if (!projectName || !email) {
    throw new Error('waitForInvite requires projectName and email');
  }
  const project = waitForProject(projectName, timeoutMs);
  let path =
    '/rest/v1/invite?project_id=eq.' +
    project.id +
    '&email=eq.' +
    encodeURIComponent(email) +
    '&select=id,status,receiver_profile_id,email';
  if (status) {
    path += '&status=eq.' + encodeURIComponent(status);
  }
  return waitForRows(path, 'invite ' + email, timeoutMs);
}

function waitForRequest(projectName, senderEmail, status, timeoutMs) {
  if (!projectName || !senderEmail) {
    throw new Error('waitForRequest requires projectName and senderEmail');
  }
  const project = waitForProject(projectName, timeoutMs);
  const sender = getUserByEmail(senderEmail);
  let path =
    '/rest/v1/request?project_id=eq.' +
    project.id +
    '&sender_profile_id=eq.' +
    sender.id +
    '&select=id,status';
  if (status) {
    path += '&status=eq.' + encodeURIComponent(status);
  }
  return waitForRows(path, 'request ' + senderEmail, timeoutMs);
}

function waitForMembership(projectName, email, timeoutMs) {
  if (!projectName || !email) {
    throw new Error('waitForMembership requires projectName and email');
  }
  const project = waitForProject(projectName, timeoutMs);
  const user = getUserByEmail(email);
  return waitForRows(
    '/rest/v1/profile_project_link?project_id=eq.' +
      project.id +
      '&profile_id=eq.' +
      user.id +
      '&active=eq.true&select=profile_id,membership,active',
    'membership ' + email,
    timeoutMs
  );
}

function waitForNoMembership(projectName, email, timeoutMs) {
  if (!projectName || !email) {
    throw new Error('waitForNoMembership requires projectName and email');
  }
  const project = waitForProject(projectName, timeoutMs);
  const user = getUserByEmail(email);
  const deadline = Date.now() + (timeoutMs || 30000);
  const path =
    '/rest/v1/profile_project_link?project_id=eq.' +
    project.id +
    '&profile_id=eq.' +
    user.id +
    '&active=eq.true&select=profile_id';
  let lastBody = '';

  while (Date.now() < deadline) {
    const response = http.get(supabaseUrl + path, {
      headers: getDefaultHeaders()
    });
    lastBody = response.body;
    if (response.status === 200) {
      const rows = JSON.parse(response.body);
      if (!rows || rows.length === 0) {
        console.log('Membership removed for', email);
        return true;
      }
    }
    sleep(1000);
  }

  throw new Error(
    'Timed out waiting for membership removal of ' +
      email +
      '. Last response: ' +
      lastBody
  );
}

function setProfileActive(email, active) {
  if (!email) {
    throw new Error('setProfileActive requires email');
  }
  const user = getUserByEmail(email);
  const isActive = active === true || active === 'true';
  const row = restPatch('profile?id=eq.' + user.id, { active: isActive });
  console.log('Set profile active', email, isActive);
  return row;
}

function waitForProfileActive(email, active, timeoutMs) {
  if (!email) {
    throw new Error('waitForProfileActive requires email');
  }
  const user = getUserByEmail(email);
  const isActive = active === true || active === 'true';
  return waitForRows(
    '/rest/v1/profile?id=eq.' +
      user.id +
      '&active=eq.' +
      isActive +
      '&select=id,active',
    'profile ' + email + ' active=' + isActive,
    timeoutMs
  );
}

function waitForQuestDownload(questName, email, downloaded, timeoutMs) {
  if (!questName || typeof questName !== 'string' || questName.trim() === '') {
    throw new Error(
      'Quest name is required and must be a non-empty string. Received: ' +
        questName
    );
  }
  if (!email || typeof email !== 'string' || email.trim() === '') {
    throw new Error(
      'Email is required and must be a non-empty string. Received: ' + email
    );
  }

  const user = getUserByEmail(email);
  const wantDownloaded = downloaded !== false && downloaded !== 'false';
  const deadline = Date.now() + (timeoutMs || 45000);
  let lastBody = '';

  while (Date.now() < deadline) {
    const response = http.get(
      supabaseUrl +
        '/rest/v1/quest?name=eq.' +
        encodeURIComponent(questName) +
        '&select=id,download_profiles',
      { headers: getDefaultHeaders() }
    );
    lastBody = response.body;

    if (response.status === 200) {
      const rows = JSON.parse(response.body);
      if (rows && rows.length > 0) {
        const profiles = rows[0].download_profiles || [];
        let found = false;
        for (let i = 0; i < profiles.length; i++) {
          if (String(profiles[i]) === String(user.id)) {
            found = true;
            break;
          }
        }
        if (found === wantDownloaded) {
          console.log(
            'Quest',
            questName,
            wantDownloaded ? 'downloaded by' : 'offloaded by',
            email
          );
          return rows[0];
        }
      }
    }

    sleep(1000);
  }

  throw new Error(
    'Timed out waiting for quest ' +
      questName +
      (wantDownloaded ? ' to include ' : ' to drop ') +
      email +
      ' in download_profiles. Last response: ' +
      lastBody
  );
}

function waitForFeedback(title, timeoutMs) {
  if (!title || typeof title !== 'string' || title.trim() === '') {
    throw new Error(
      'Feedback title is required and must be a non-empty string. Received: ' +
        title
    );
  }
  return waitForRows(
    '/rest/v1/feedback?title=eq.' +
      encodeURIComponent(title) +
      '&select=id,title',
    'feedback ' + title,
    timeoutMs
  );
}

function waitForReport(details, timeoutMs) {
  if (!details || typeof details !== 'string' || details.trim() === '') {
    throw new Error(
      'Report details are required and must be a non-empty string. Received: ' +
        details
    );
  }
  return waitForRows(
    '/rest/v1/reports?details=eq.' +
      encodeURIComponent(details) +
      '&select=id,reason,details',
    'report ' + details,
    timeoutMs
  );
}

function waitForContentText(text, timeoutMs) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    throw new Error(
      'Content text is required and must be a non-empty string. Received: ' +
        text
    );
  }
  return waitForRows(
    '/rest/v1/asset_content_link?text=eq.' +
      encodeURIComponent(text) +
      '&select=id,asset_id,text',
    'content ' + text,
    timeoutMs
  );
}

function waitForNoContentText(text, settleMs) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    throw new Error('waitForNoContentText requires text. Received: ' + text);
  }
  sleep(settleMs || 5000);
  const rows = restGet(
    'asset_content_link?text=eq.' + encodeURIComponent(text) + '&select=id,text'
  );
  if (rows && rows.length > 0) {
    throw new Error('Content already on the server: ' + text);
  }
  console.log('Content not on server yet:', text);
  return true;
}

function waitForVote(assetId, creatorEmail, polarity, timeoutMs) {
  if (!assetId || !creatorEmail) {
    throw new Error('waitForVote requires assetId and creatorEmail');
  }
  const user = getUserByEmail(creatorEmail);
  let path =
    '/rest/v1/vote?asset_id=eq.' +
    assetId +
    '&creator_id=eq.' +
    user.id +
    '&select=id,polarity,asset_id,creator_id';
  if (polarity) {
    path += '&polarity=eq.' + encodeURIComponent(polarity);
  }
  return waitForRows(path, 'vote ' + creatorEmail, timeoutMs);
}

function waitForNoVote(assetId, creatorEmail, settleMs) {
  if (!assetId || !creatorEmail) {
    throw new Error('waitForNoVote requires assetId and creatorEmail');
  }
  const user = getUserByEmail(creatorEmail);
  sleep(settleMs || 5000);
  const rows = restGet(
    'vote?asset_id=eq.' + assetId + '&creator_id=eq.' + user.id + '&select=id'
  );
  if (rows && rows.length > 0) {
    throw new Error('Vote already on the server for ' + creatorEmail);
  }
  console.log('Vote not on server yet:', creatorEmail);
  return true;
}

output.api = {
  assertInsertedOnce,
  createConfirmedUser,
  deleteUser,
  deleteUserIfExists,
  generatePasswordResetLink,
  deleteProject,
  waitForProject,
  waitForLanguoid,
  waitForQuest,
  waitForAsset,
  waitForAssetContent,
  waitForQuestAssetName,
  waitForAssetVisible,
  waitForAssetActive,
  waitForQuestAssetLinkState,
  waitForQuestAssetOrder,
  waitForRecordedAudio,
  waitForNoRecordedAudio,
  waitForAudioUploaded,
  waitForAudioCount,
  assertFlatObjectName,
  assertEqual,
  assertNotEqual,
  waitForQuestPublished,
  storageObjectExists,
  waitForStorageObject,
  waitForStorageObjectGone,
  deleteStorageObjects,
  waitForDeletionQueued,
  waitForDeletionNotQueued,
  runStorageDeletionSweep,
  expectSweepAction,
  waitForSweptObjectGone,
  cleanupStorageObjects,
  waitForInvite,
  waitForRequest,
  waitForMembership,
  waitForNoMembership,
  waitForProfileActive,
  waitForQuestDownload,
  waitForFeedback,
  waitForReport,
  waitForContentText,
  waitForNoContentText,
  waitForVote,
  waitForNoVote,
  seedProject,
  seedQuest,
  seedBibleHierarchy,
  seedSourceAsset,
  seedAudioAsset,
  linkAssetToQuest,
  seedTranslation,
  seedInvite,
  seedRequest,
  setProfileActive,
  uniqueEmail,
  uniquePassword,
  updateUserPassword
};
