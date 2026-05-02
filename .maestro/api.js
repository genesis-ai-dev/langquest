const supabaseUrl = MAESTRO_SUPABASE_URL;
const serviceRoleKey = MAESTRO_SUPABASE_SERVICE_ROLE_KEY;
const siteUrl = MAESTRO_SITE_URL;

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
    console.log(
      'Available users:',
      users.map((u) => u.email).join(', ')
    );
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

function generatePasswordResetLink(email) {
  // Validate email is defined and is a non-empty string
  if (!email || typeof email !== 'string' || email.trim() === '') {
    throw new Error(
      'Email is required and must be a non-empty string. Received: ' + email
    );
  }

  console.log('Generating password reset link for email:', email);

  // Default to 'en' locale
  const locale = 'en';
  const finalRedirectTo = `${siteUrl}/${locale}/reset-password`;

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

function deleteProject(projectName) {
  // Validate projectName is defined and is a non-empty string
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

  // First, get the project by name using Supabase REST API
  const getProjectResponse = http.get(
    supabaseUrl +
      '/rest/v1/project?name=eq.' +
      encodeURIComponent(projectName) +
      '&select=id',
    {
      headers: getDefaultHeaders({ Prefer: 'return=representation' })
    }
  );

  if (getProjectResponse.status !== 200) {
    throw new Error(
      'Failed to query project: ' +
        getProjectResponse.status +
        ' ' +
        getProjectResponse.body
    );
  }

  // Parse the response to get the project ID
  const projects = JSON.parse(getProjectResponse.body);
  if (!projects || projects.length === 0) {
    throw new Error('Project not found with name: ' + projectName);
  }

  const projectId = projects[0].id;
  console.log('Found project ID:', projectId);

  // Delete the project by ID
  const deleteResponse = http.delete(
    supabaseUrl + '/rest/v1/project?id=eq.' + projectId,
    {
      headers: getDefaultHeaders({ Prefer: 'return=representation' })
    }
  );

  if (deleteResponse.status !== 200 && deleteResponse.status !== 204) {
    throw new Error(
      'Failed to delete project: ' +
        deleteResponse.status +
        ' ' +
        deleteResponse.body
    );
  }

  console.log('Successfully deleted project:', projectName);
  return deleteResponse;
}

output.api = {
  deleteUser,
  generatePasswordResetLink,
  deleteProject,
  updateUserPassword
};
