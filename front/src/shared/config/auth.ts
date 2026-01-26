export const authConfig = {
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080',
  redirectUri:
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : '',
};

export const getGoogleAuthUrl = () => {
  const params = new URLSearchParams({
    client_id: authConfig.googleClientId,
    redirect_uri: authConfig.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};
