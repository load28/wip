import { authConfig } from '@/shared/config/auth';

const API_BASE = authConfig.backendUrl;

/**
 * 브라우저가 WebAuthn을 지원하는지 확인
 */
export function isPasskeySupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined'
  );
}

/**
 * Base64URL 문자열을 ArrayBuffer로 변환
 */
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

/**
 * ArrayBuffer를 Base64URL 문자열로 변환
 */
function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * 패스키 등록 (로그인된 사용자가 패스키 추가)
 */
export async function registerPasskey(): Promise<void> {
  // 1. 서버에서 등록 옵션 요청
  const optionsRes = await fetch(`${API_BASE}/api/passkey/register/options`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!optionsRes.ok) {
    const err = await optionsRes.json();
    throw new Error(err.error || '패스키 등록 옵션 요청 실패');
  }

  const options = await optionsRes.json();

  // 2. WebAuthn API 호출하여 credential 생성
  const publicKeyOptions: PublicKeyCredentialCreationOptions = {
    challenge: base64urlToBuffer(options.challenge),
    rp: {
      id: options.rp.id,
      name: options.rp.name,
    },
    user: {
      id: base64urlToBuffer(options.user.id),
      name: options.user.name,
      displayName: options.user.displayName,
    },
    pubKeyCredParams: options.pubKeyCredParams.map(
      (p: { type: string; alg: number }) => ({
        type: p.type as PublicKeyCredentialType,
        alg: p.alg,
      }),
    ),
    timeout: options.timeout,
    attestation: options.attestation as AttestationConveyancePreference,
    authenticatorSelection: {
      authenticatorAttachment:
        options.authenticatorSelection.authenticatorAttachment as AuthenticatorAttachment | undefined,
      residentKey:
        options.authenticatorSelection.residentKey as ResidentKeyRequirement,
      requireResidentKey:
        options.authenticatorSelection.requireResidentKey,
      userVerification:
        options.authenticatorSelection.userVerification as UserVerificationRequirement,
    },
    excludeCredentials: options.excludeCredentials?.map(
      (c: { id: string; type: string }) => ({
        id: base64urlToBuffer(c.id),
        type: c.type as PublicKeyCredentialType,
      }),
    ),
  };

  const credential = (await navigator.credentials.create({
    publicKey: publicKeyOptions,
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('패스키 생성이 취소되었습니다');
  }

  const attestationResponse =
    credential.response as AuthenticatorAttestationResponse;

  // 3. 서버에 등록 응답 전송
  const completeRes = await fetch(
    `${API_BASE}/api/passkey/register/complete`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: credential.id,
        rawId: bufferToBase64url(credential.rawId),
        response: {
          clientDataJson: bufferToBase64url(
            attestationResponse.clientDataJSON,
          ),
          attestationObject: bufferToBase64url(
            attestationResponse.attestationObject,
          ),
        },
        type: credential.type,
      }),
    },
  );

  if (!completeRes.ok) {
    const err = await completeRes.json();
    throw new Error(err.error || '패스키 등록 실패');
  }
}

interface PasskeyLoginResult {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
  };
  csrfToken: string;
}

/**
 * 패스키로 로그인 (Discoverable Credential)
 */
export async function authenticateWithPasskey(): Promise<PasskeyLoginResult> {
  // 1. 서버에서 인증 옵션 요청
  const optionsRes = await fetch(
    `${API_BASE}/api/passkey/authenticate/options`,
    {
      method: 'POST',
      credentials: 'include',
    },
  );

  if (!optionsRes.ok) {
    const err = await optionsRes.json();
    throw new Error(err.error || '패스키 인증 옵션 요청 실패');
  }

  const options = await optionsRes.json();

  // 2. WebAuthn API 호출
  const publicKeyOptions: PublicKeyCredentialRequestOptions = {
    challenge: base64urlToBuffer(options.challenge),
    timeout: options.timeout,
    rpId: options.rpId,
    allowCredentials: options.allowCredentials?.map(
      (c: { id: string; type: string }) => ({
        id: base64urlToBuffer(c.id),
        type: c.type as PublicKeyCredentialType,
      }),
    ) || [],
    userVerification:
      options.userVerification as UserVerificationRequirement,
  };

  const assertion = (await navigator.credentials.get({
    publicKey: publicKeyOptions,
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new Error('패스키 인증이 취소되었습니다');
  }

  const assertionResponse =
    assertion.response as AuthenticatorAssertionResponse;

  // 3. 서버에 인증 응답 전송
  const completeRes = await fetch(
    `${API_BASE}/api/passkey/authenticate/complete`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: assertion.id,
        rawId: bufferToBase64url(assertion.rawId),
        response: {
          clientDataJson: bufferToBase64url(
            assertionResponse.clientDataJSON,
          ),
          authenticatorData: bufferToBase64url(
            assertionResponse.authenticatorData,
          ),
          signature: bufferToBase64url(assertionResponse.signature),
          userHandle: assertionResponse.userHandle
            ? bufferToBase64url(assertionResponse.userHandle)
            : null,
        },
        type: assertion.type,
      }),
    },
  );

  if (!completeRes.ok) {
    const err = await completeRes.json();
    throw new Error(err.error || '패스키 인증 실패');
  }

  return completeRes.json();
}
