import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function emptyResponse(status: number): Response {
  return new Response(null, { status, headers: corsHeaders });
}

function errorResponse(status: number, message: string): Response {
  return Response.json(
    { error: message },
    { status, headers: corsHeaders },
  );
}

function readBearerToken(request: Request): string | null {
  const authorization = request.headers.get('Authorization');
  const match = authorization?.match(/^Bearer ([^\s]+)$/i);
  return match?.[1] ?? null;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return emptyResponse(204);
  }

  if (request.method !== 'POST') {
    return errorResponse(405, 'Method not allowed.');
  }

  const token = readBearerToken(request);
  if (!token) {
    return errorResponse(401, 'Authentication required.');
  }

  // This endpoint intentionally accepts no target identity or other payload.
  if ((await request.text()).trim() !== '') {
    return errorResponse(400, 'Request body must be empty.');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse(500, 'Account deletion is temporarily unavailable.');
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const { data: claimsData, error: claimsError } =
      await adminClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    const sessionId = claimsData?.claims?.session_id;

    if (
      claimsError ||
      typeof userId !== 'string' ||
      !uuidPattern.test(userId) ||
      typeof sessionId !== 'string' ||
      !uuidPattern.test(sessionId)
    ) {
      return errorResponse(401, 'Authentication required.');
    }

    const { data: userData, error: userError } =
      await adminClient.auth.getUser(token);

    // A still-valid signed token can reach this branch after a successful
    // deletion whose response was lost. Treat that retry as complete without
    // accepting a client-supplied identity.
    if (userError?.code === 'user_not_found') {
      return emptyResponse(204);
    }

    if (userError || !userData.user) {
      return errorResponse(500, 'Could not verify the account. Try again.');
    }

    if (userData.user.id !== userId) {
      return errorResponse(401, 'Authentication required.');
    }

    const { data: sessionIsActive, error: sessionError } =
      await adminClient.rpc('account_deletion_session_is_active', {
        p_user_id: userId,
        p_session_id: sessionId,
      });

    if (sessionError) {
      return errorResponse(500, 'Could not verify the account. Try again.');
    }

    if (sessionIsActive !== true) {
      // A concurrent successful deletion removes the session before this
      // request reaches the Auth Admin call. Distinguish that idempotent case
      // from an ordinary revoked session.
      const { error: currentUserError } = await adminClient.auth.getUser(token);
      if (currentUserError?.code === 'user_not_found') {
        return emptyResponse(204);
      }

      if (currentUserError) {
        return errorResponse(500, 'Could not verify the account. Try again.');
      }

      return errorResponse(401, 'Authentication required.');
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(
      userId,
      false,
    );

    if (deleteError?.code === 'user_not_found') {
      return emptyResponse(204);
    }

    if (deleteError) {
      return errorResponse(500, 'Could not delete the account. Try again.');
    }

    return emptyResponse(204);
  } catch {
    return errorResponse(500, 'Could not delete the account. Try again.');
  }
});
