const supabaseUrl = MAESTRO_SUPABASE_URL;
const serviceRoleKey = MAESTRO_SUPABASE_SERVICE_ROLE_KEY;

function deleteUser(email) {
  // Validate email is defined and is a non-empty string
  if (!email || typeof email !== 'string' || email.trim() === '') {
    throw new Error(
      'Email is required and must be a non-empty string. Received: ' + email
    );
  }

  console.log('Deleting user with email:', email);
  // First, get the user by email
  const getUserResponse = http.get(
    supabaseUrl + '/auth/v1/admin/users?email=' + encodeURIComponent(email),
    {
      headers: {
        Authorization: 'Bearer ' + serviceRoleKey,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json'
      }
    }
  );

  // Parse the response to get the user ID
  const responseData = JSON.parse(getUserResponse.body);
  // Supabase Admin API returns { users: [...] } format
  const users = responseData.users || responseData;
  if (!users || users.length === 0) {
    throw new Error('User not found with email: ' + email);
  }

  const userId = users[0].id;
  console.log('Found user ID:', userId);

  // Delete the user by ID
  return http.delete(supabaseUrl + '/auth/v1/admin/users/' + userId, {
    headers: {
      Authorization: 'Bearer ' + serviceRoleKey,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json'
    }
  });
}

function generatePasswordResetLink(email) {
  // Validate email is defined and is a non-empty string
  if (!email || typeof email !== 'string' || email.trim() === '') {
    throw new Error(
      'Email is required and must be a non-empty string. Received: ' + email
    );
  }

  console.log('Generating password reset link for email:', email);

  // Extract project ref from Supabase URL (format: https://{projectRef}.supabase.co/...)
  const supabaseUrlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\./);
  const projectRef = supabaseUrlMatch ? supabaseUrlMatch[1] : null;

  if (!projectRef) {
    throw new Error(
      'Could not extract project ref from Supabase URL: ' + supabaseUrl
    );
  }

  // Construct redirect_to URL in the same format as send-email function
  // Format: https://langquest.org/en/reset-password?project_ref={projectRef}
  // Default to 'en' locale
  const locale = 'en';
  const finalRedirectTo = `https://langquest.org/${locale}/reset-password?project_ref=${projectRef}`;

  console.log('Using project ref:', projectRef);
  console.log('Using redirect URL:', finalRedirectTo);

  // Use Supabase Admin API to generate a recovery link
  const generateLinkResponse = http.post(
    supabaseUrl + '/auth/v1/admin/generate_link',
    {
      headers: {
        Authorization: 'Bearer ' + serviceRoleKey,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json'
      },
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
  // https://langquest.org/supabase/{projectRef}/auth/v1/verify?token=xxx&type=recovery&redirect_to=https://langquest.org/en/reset-password?project_ref={projectRef}

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
    resetLink = `https://langquest.org/supabase/${projectRef}/auth/v1/verify?token=${token}&type=${type}&redirect_to=${encodedRedirectTo}`;
    console.log('Reconstructed reset link matching send-email format');
  } else {
    console.log('Could not parse reset link, using as-is');
  }

  console.log('Generated password reset link:', resetLink);
  return resetLink;
}

output.api = {
  deleteUser,
  generatePasswordResetLink
};
