const supabaseUrl = MAESTRO_SUPABASE_URL;
const serviceRoleKey = MAESTRO_SUPABASE_SERVICE_ROLE_KEY;
const siteUrl = MAESTRO_SITE_URL;
const projectIdOverride = MAESTRO_PROJECT_ID_LOCAL_OVERRIDE;

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

  const responseData = JSON.parse(getUserResponse.body);
  const users = responseData.users || responseData;

  if (!users || users.length === 0) {
    throw new Error('User not found with email: ' + email);
  }

  return users[0];
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
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    throw new Error(
      'Password is required and must be at least 6 characters. Received: ' + newPassword
    );
  }

  const user = getUserByEmail(email);
  console.log('Found user ID:', user.id);
  console.log('Updating password for user:', email);

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

  if (updateResponse.status !== 200) {
    throw new Error(
      'Failed to update password: ' + updateResponse.status + ' ' + updateResponse.body
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

  // Use override if provided, otherwise extract from Supabase URL
  let projectRef = projectIdOverride;

  if (!projectRef) {
    // Extract project ref from Supabase URL (format: https://{projectRef}.supabase.co/...)
    const supabaseUrlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\./);
    projectRef = supabaseUrlMatch ? supabaseUrlMatch[1] : null;
  }

  if (!projectRef) {
    throw new Error(
      'Could not extract project ref from Supabase URL: ' + supabaseUrl
    );
  }

  // Construct redirect_to URL in the same format as send-email function
  // Format: https://langquest.org/en/reset-password?project_ref={projectRef}
  // Default to 'en' locale
  const locale = 'en';
  const finalRedirectTo = `${siteUrl}/${locale}/reset-password?project_ref=${projectRef}`;

  console.log('Using project ref:', projectRef);
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

  // The generate_link API returns a link that goes through Supabase's verification endpoint
  // We need to reconstruct it to match the send-email format:
  // {siteUrl}/supabase/{projectRef}/auth/v1/verify?token=xxx&type=recovery&redirect_to={siteUrl}/en/reset-password?project_ref={projectRef}

  // Parse and update the redirect_to parameter manually (URL constructor may not be available in GraalJS)
  // Extract token and other params, then reconstruct with the web reset password URL
  const tokenMatch = resetLink.match(/[?&]token=([^&]+)/);
  const typeMatch = resetLink.match(/[?&]type=([^&]+)/);

  if (tokenMatch && projectRef) {
    const token = tokenMatch[1];
    const type = typeMatch ? typeMatch[1] : 'recovery';

    // URL-encode the redirect URL for use in query parameter
    const encodedRedirectTo = encodeURIComponent(finalRedirectTo);

    // Reconstruct the verification URL in the same format as send-email function
    resetLink = `${siteUrl}/supabase/${projectRef}/auth/v1/verify?token=${token}&type=${type}&redirect_to=${encodedRedirectTo}`;
    console.log('Reconstructed reset link matching send-email format');
  } else {
    console.log('Could not parse reset link, using as-is');
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
