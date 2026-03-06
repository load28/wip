import { authConfig } from '@/shared/config/auth';

const WEBAUTHN_BASE = `${authConfig.backendUrl}/api/webauthn`;

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function prepareCreationOptions(
  options: PublicKeyCredentialCreationOptions
): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    challenge: base64urlToBuffer(options.challenge as unknown as string),
    user: {
      ...options.user,
      id: base64urlToBuffer(options.user.id as unknown as string),
    },
    excludeCredentials: options.excludeCredentials?.map((cred) => ({
      ...cred,
      id: base64urlToBuffer(cred.id as unknown as string),
    })),
  };
}

function prepareRequestOptions(
  options: PublicKeyCredentialRequestOptions
): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: base64urlToBuffer(options.challenge as unknown as string),
    allowCredentials: options.allowCredentials?.map((cred) => ({
      ...cred,
      id: base64urlToBuffer(cred.id as unknown as string),
    })),
  };
}

function credentialToJSON(credential: PublicKeyCredential) {
  const response = credential.response;

  const result: Record<string, unknown> = {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    extensions: credential.getClientExtensionResults(),
  };

  if ('attestationObject' in response) {
    const attestationResponse = response as AuthenticatorAttestationResponse;
    result.response = {
      attestationObject: bufferToBase64url(
        attestationResponse.attestationObject
      ),
      clientDataJSON: bufferToBase64url(attestationResponse.clientDataJSON),
    };
  } else {
    const assertionResponse = response as AuthenticatorAssertionResponse;
    result.response = {
      authenticatorData: bufferToBase64url(assertionResponse.authenticatorData),
      clientDataJSON: bufferToBase64url(assertionResponse.clientDataJSON),
      signature: bufferToBase64url(assertionResponse.signature),
      userHandle: assertionResponse.userHandle
        ? bufferToBase64url(assertionResponse.userHandle)
        : null,
    };
  }

  return result;
}

export async function registerPasskey(name?: string): Promise<void> {
  const beginRes = await fetch(`${WEBAUTHN_BASE}/register/begin`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!beginRes.ok) throw new Error('패스키 등록 시작 실패');

  const beginData = await beginRes.json();
  // webauthn-rs returns { public_key: { publicKey: { ... } } }
  const publicKeyOptions =
    beginData.public_key?.publicKey ?? beginData.publicKey;

  const credential = (await navigator.credentials.create({
    publicKey: prepareCreationOptions(publicKeyOptions),
  })) as PublicKeyCredential;

  if (!credential) throw new Error('패스키 생성이 취소되었습니다');

  const finishRes = await fetch(`${WEBAUTHN_BASE}/register/finish`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      credential: credentialToJSON(credential),
      name: name || undefined,
    }),
  });
  if (!finishRes.ok) throw new Error('패스키 등록 완료 실패');
}

export async function authenticateWithPasskey(): Promise<{
  userId: string;
  email: string;
  name: string;
  csrfToken: string;
}> {
  const beginRes = await fetch(`${WEBAUTHN_BASE}/auth/begin`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!beginRes.ok) throw new Error('패스키 인증 시작 실패');

  const beginData = await beginRes.json();
  const sessionId = beginData.session_id;
  // webauthn-rs returns { public_key: { publicKey: { ... } } }
  const publicKeyOptions =
    beginData.public_key?.publicKey ?? beginData.publicKey;

  const credential = (await navigator.credentials.get({
    publicKey: prepareRequestOptions(publicKeyOptions),
  })) as PublicKeyCredential;

  if (!credential) throw new Error('패스키 인증이 취소되었습니다');

  const finishRes = await fetch(`${WEBAUTHN_BASE}/auth/finish`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      credential: credentialToJSON(credential),
      session_id: sessionId,
    }),
  });
  if (!finishRes.ok) throw new Error('패스키 인증 실패');

  return finishRes.json();
}

export async function authenticateWithConditionalUI(
  abortController: AbortController
): Promise<{
  userId: string;
  email: string;
  name: string;
  csrfToken: string;
} | null> {
  const beginRes = await fetch(`${WEBAUTHN_BASE}/auth/begin`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!beginRes.ok) return null;

  const beginData = await beginRes.json();
  const sessionId = beginData.session_id;
  const publicKeyOptions =
    beginData.public_key?.publicKey ?? beginData.publicKey;

  try {
    const credential = (await navigator.credentials.get({
      publicKey: prepareRequestOptions(publicKeyOptions),
      mediation: 'conditional' as CredentialMediationRequirement,
      signal: abortController.signal,
    })) as PublicKeyCredential;

    if (!credential) return null;

    const finishRes = await fetch(`${WEBAUTHN_BASE}/auth/finish`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credential: credentialToJSON(credential),
        session_id: sessionId,
      }),
    });
    if (!finishRes.ok) return null;

    return finishRes.json();
  } catch {
    return null;
  }
}

export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined'
  );
}

export async function isConditionalUISupported(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isConditionalMediationAvailable();
  } catch {
    return false;
  }
}

export async function listPasskeys(): Promise<
  Array<{
    id: string;
    name: string;
    createdAt: string;
    lastUsedAt: string | null;
  }>
> {
  const res = await fetch(`${WEBAUTHN_BASE}/credentials`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('패스키 목록 조회 실패');
  return res.json();
}

export async function deletePasskey(id: string): Promise<void> {
  const res = await fetch(`${WEBAUTHN_BASE}/credentials/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('패스키 삭제 실패');
}
