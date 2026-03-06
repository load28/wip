use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use p256::ecdsa::{signature::Verifier, Signature, VerifyingKey};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::config::Config;
use crate::error::AppError;

/// 등록 옵션 (서버 → 클라이언트)
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistrationOptions {
    pub challenge: String,
    pub rp: RelyingParty,
    pub user: PublicKeyUser,
    pub pub_key_cred_params: Vec<PubKeyCredParam>,
    pub timeout: u64,
    pub attestation: String,
    pub authenticator_selection: AuthenticatorSelection,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub exclude_credentials: Vec<CredentialDescriptor>,
}

#[derive(Debug, Serialize)]
pub struct RelyingParty {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicKeyUser {
    pub id: String,
    pub name: String,
    pub display_name: String,
}

#[derive(Debug, Serialize)]
pub struct PubKeyCredParam {
    #[serde(rename = "type")]
    pub cred_type: String,
    pub alg: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthenticatorSelection {
    pub authenticator_attachment: Option<String>,
    pub resident_key: String,
    pub require_resident_key: bool,
    pub user_verification: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialDescriptor {
    pub id: String,
    #[serde(rename = "type")]
    pub cred_type: String,
}

/// 인증 옵션 (서버 → 클라이언트)
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthenticationOptions {
    pub challenge: String,
    pub timeout: u64,
    pub rp_id: String,
    pub allow_credentials: Vec<CredentialDescriptor>,
    pub user_verification: String,
}

/// 클라이언트에서 전송하는 등록 응답
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistrationResponse {
    pub id: String,
    pub raw_id: String,
    pub response: AuthenticatorAttestationResponse,
    #[serde(rename = "type")]
    pub cred_type: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthenticatorAttestationResponse {
    pub client_data_json: String,
    pub attestation_object: String,
}

/// 클라이언트에서 전송하는 인증 응답
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthenticationResponse {
    pub id: String,
    pub raw_id: String,
    pub response: AuthenticatorAssertionResponse,
    #[serde(rename = "type")]
    pub cred_type: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthenticatorAssertionResponse {
    pub client_data_json: String,
    pub authenticator_data: String,
    pub signature: String,
    pub user_handle: Option<String>,
}

/// clientDataJSON 파싱 결과
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClientData {
    #[serde(rename = "type")]
    client_type: String,
    challenge: String,
    origin: String,
}

/// 등록 검증 결과
pub struct RegistrationResult {
    pub credential_id: Vec<u8>,
    pub public_key: Vec<u8>,
    pub sign_count: u32,
    pub aaguid: [u8; 16],
}

/// 인증 검증 결과
pub struct AuthenticationResult {
    pub credential_id: String,
    pub user_handle: Option<String>,
    pub new_sign_count: u32,
}

pub struct WebAuthnService;

impl WebAuthnService {
    /// 32바이트 랜덤 challenge 생성
    pub fn generate_challenge() -> String {
        let mut challenge = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut challenge);
        URL_SAFE_NO_PAD.encode(challenge)
    }

    /// 등록 옵션 생성
    pub fn create_registration_options(
        config: &Config,
        user_id: &str,
        user_name: &str,
        user_display_name: &str,
        exclude_credential_ids: Vec<String>,
    ) -> RegistrationOptions {
        let challenge = Self::generate_challenge();

        let exclude_credentials = exclude_credential_ids
            .into_iter()
            .map(|id| CredentialDescriptor {
                id,
                cred_type: "public-key".to_string(),
            })
            .collect();

        RegistrationOptions {
            challenge,
            rp: RelyingParty {
                id: config.rp_id.clone(),
                name: config.rp_name.clone(),
            },
            user: PublicKeyUser {
                id: URL_SAFE_NO_PAD.encode(user_id.as_bytes()),
                name: user_name.to_string(),
                display_name: user_display_name.to_string(),
            },
            pub_key_cred_params: vec![
                PubKeyCredParam {
                    cred_type: "public-key".to_string(),
                    alg: -7, // ES256
                },
                PubKeyCredParam {
                    cred_type: "public-key".to_string(),
                    alg: -257, // RS256
                },
            ],
            timeout: 60000,
            attestation: "none".to_string(),
            authenticator_selection: AuthenticatorSelection {
                authenticator_attachment: None,
                resident_key: "preferred".to_string(),
                require_resident_key: false,
                user_verification: "preferred".to_string(),
            },
            exclude_credentials,
        }
    }

    /// 인증 옵션 생성 (Discoverable Credential: allowCredentials 비워둠)
    pub fn create_authentication_options(config: &Config) -> AuthenticationOptions {
        let challenge = Self::generate_challenge();

        AuthenticationOptions {
            challenge,
            timeout: 60000,
            rp_id: config.rp_id.clone(),
            allow_credentials: vec![],
            user_verification: "preferred".to_string(),
        }
    }

    /// 등록 응답 검증
    pub fn verify_registration(
        config: &Config,
        response: &RegistrationResponse,
        expected_challenge: &str,
    ) -> Result<RegistrationResult, AppError> {
        // 1. clientDataJSON 디코딩 및 검증
        let client_data_bytes = URL_SAFE_NO_PAD
            .decode(&response.response.client_data_json)
            .map_err(|_| AppError::bad_request("clientDataJSON 디코딩 실패"))?;

        let client_data: ClientData = serde_json::from_slice(&client_data_bytes)
            .map_err(|_| AppError::bad_request("clientDataJSON 파싱 실패"))?;

        // type 검증
        if client_data.client_type != "webauthn.create" {
            return Err(AppError::bad_request("잘못된 clientData type"));
        }

        // challenge 검증
        if client_data.challenge != expected_challenge {
            return Err(AppError::bad_request("챌린지가 일치하지 않습니다"));
        }

        // origin 검증 (피싱 방어의 핵심)
        if client_data.origin != config.rp_origin {
            return Err(AppError::bad_request(format!(
                "origin 불일치: expected={}, got={}",
                config.rp_origin, client_data.origin
            )));
        }

        // 2. attestationObject 디코딩 (CBOR)
        let attestation_bytes = URL_SAFE_NO_PAD
            .decode(&response.response.attestation_object)
            .map_err(|_| AppError::bad_request("attestationObject 디코딩 실패"))?;

        let attestation: ciborium::Value = ciborium::from_reader(&attestation_bytes[..])
            .map_err(|_| AppError::bad_request("attestationObject CBOR 파싱 실패"))?;

        // authData 추출
        let auth_data = Self::extract_auth_data(&attestation)?;

        // 3. authData 파싱
        if auth_data.len() < 37 {
            return Err(AppError::bad_request("authData가 너무 짧습니다"));
        }

        // RP ID 해시 검증 (처음 32바이트)
        let rp_id_hash = &auth_data[0..32];
        let mut hasher = Sha256::new();
        hasher.update(config.rp_id.as_bytes());
        let expected_rp_id_hash = hasher.finalize();

        if rp_id_hash != expected_rp_id_hash.as_slice() {
            return Err(AppError::bad_request("RP ID 해시 불일치"));
        }

        // flags 검증 (bit 0: UP, bit 6: AT)
        let flags = auth_data[32];
        if flags & 0x01 == 0 {
            return Err(AppError::bad_request("User Present 플래그가 설정되지 않았습니다"));
        }
        if flags & 0x40 == 0 {
            return Err(AppError::bad_request(
                "Attested Credential Data 플래그가 설정되지 않았습니다",
            ));
        }

        // signCount (4바이트, big-endian)
        let sign_count = u32::from_be_bytes([auth_data[33], auth_data[34], auth_data[35], auth_data[36]]);

        // AAGUID (16바이트)
        let mut aaguid = [0u8; 16];
        aaguid.copy_from_slice(&auth_data[37..53]);

        // Credential ID 길이 (2바이트, big-endian)
        let cred_id_len = u16::from_be_bytes([auth_data[53], auth_data[54]]) as usize;

        if auth_data.len() < 55 + cred_id_len {
            return Err(AppError::bad_request("authData credential ID 영역이 부족합니다"));
        }

        // Credential ID
        let credential_id = auth_data[55..55 + cred_id_len].to_vec();

        // 공개 키 (COSE 형식, credential ID 이후)
        let public_key_cbor = &auth_data[55 + cred_id_len..];
        let public_key = public_key_cbor.to_vec();

        Ok(RegistrationResult {
            credential_id,
            public_key,
            sign_count,
            aaguid,
        })
    }

    /// 인증 응답 검증
    pub fn verify_authentication(
        config: &Config,
        response: &AuthenticationResponse,
        expected_challenge: &str,
        stored_public_key: &[u8],
        stored_sign_count: i64,
    ) -> Result<AuthenticationResult, AppError> {
        // 1. clientDataJSON 디코딩 및 검증
        let client_data_bytes = URL_SAFE_NO_PAD
            .decode(&response.response.client_data_json)
            .map_err(|_| AppError::bad_request("clientDataJSON 디코딩 실패"))?;

        let client_data: ClientData = serde_json::from_slice(&client_data_bytes)
            .map_err(|_| AppError::bad_request("clientDataJSON 파싱 실패"))?;

        // type 검증
        if client_data.client_type != "webauthn.get" {
            return Err(AppError::bad_request("잘못된 clientData type"));
        }

        // challenge 검증
        if client_data.challenge != expected_challenge {
            return Err(AppError::bad_request("챌린지가 일치하지 않습니다"));
        }

        // origin 검증
        if client_data.origin != config.rp_origin {
            return Err(AppError::bad_request("origin 불일치"));
        }

        // 2. authenticatorData 디코딩
        let auth_data = URL_SAFE_NO_PAD
            .decode(&response.response.authenticator_data)
            .map_err(|_| AppError::bad_request("authenticatorData 디코딩 실패"))?;

        if auth_data.len() < 37 {
            return Err(AppError::bad_request("authenticatorData가 너무 짧습니다"));
        }

        // RP ID 해시 검증
        let rp_id_hash = &auth_data[0..32];
        let mut hasher = Sha256::new();
        hasher.update(config.rp_id.as_bytes());
        let expected_rp_id_hash = hasher.finalize();

        if rp_id_hash != expected_rp_id_hash.as_slice() {
            return Err(AppError::bad_request("RP ID 해시 불일치"));
        }

        // flags 검증 (UP bit)
        let flags = auth_data[32];
        if flags & 0x01 == 0 {
            return Err(AppError::bad_request("User Present 플래그가 설정되지 않았습니다"));
        }

        // signCount
        let new_sign_count =
            u32::from_be_bytes([auth_data[33], auth_data[34], auth_data[35], auth_data[36]]);

        // signCount 검증 (복제 탐지)
        if new_sign_count > 0 && stored_sign_count > 0 && new_sign_count as i64 <= stored_sign_count
        {
            tracing::warn!(
                "signCount 이상 감지: stored={}, received={}. 인증기 복제 가능성",
                stored_sign_count,
                new_sign_count
            );
        }

        // 3. 서명 검증
        // 검증 대상 = authenticatorData + SHA-256(clientDataJSON)
        let client_data_hash = Sha256::digest(&client_data_bytes);

        let mut signed_data = Vec::new();
        signed_data.extend_from_slice(&auth_data);
        signed_data.extend_from_slice(&client_data_hash);

        let signature_bytes = URL_SAFE_NO_PAD
            .decode(&response.response.signature)
            .map_err(|_| AppError::bad_request("서명 디코딩 실패"))?;

        Self::verify_signature(stored_public_key, &signed_data, &signature_bytes)?;

        Ok(AuthenticationResult {
            credential_id: response.id.clone(),
            user_handle: response.response.user_handle.clone(),
            new_sign_count,
        })
    }

    /// COSE 공개 키로 ES256 서명 검증
    fn verify_signature(
        cose_public_key: &[u8],
        data: &[u8],
        signature: &[u8],
    ) -> Result<(), AppError> {
        // COSE 키 파싱 (CBOR)
        let cose_key: ciborium::Value = ciborium::from_reader(cose_public_key)
            .map_err(|_| AppError::bad_request("COSE 키 파싱 실패"))?;

        let map = match &cose_key {
            ciborium::Value::Map(m) => m,
            _ => return Err(AppError::bad_request("COSE 키가 맵이 아닙니다")),
        };

        // kty (1) 확인: EC2 = 2
        let kty = Self::get_cose_int(map, 1)?;
        if kty != 2 {
            return Err(AppError::bad_request(format!(
                "지원하지 않는 키 타입: {}. EC2(2)만 지원됩니다",
                kty
            )));
        }

        // alg (3) 확인: ES256 = -7
        let alg = Self::get_cose_int(map, 3)?;
        if alg != -7 {
            return Err(AppError::bad_request(format!(
                "지원하지 않는 알고리즘: {}. ES256(-7)만 지원됩니다",
                alg
            )));
        }

        // x좌표 (-2), y좌표 (-3) 추출
        let x = Self::get_cose_bytes(map, -2)?;
        let y = Self::get_cose_bytes(map, -3)?;

        // 비압축 공개 키 구성: 0x04 || x || y
        let mut uncompressed = Vec::with_capacity(65);
        uncompressed.push(0x04);
        uncompressed.extend_from_slice(&x);
        uncompressed.extend_from_slice(&y);

        let verifying_key = VerifyingKey::from_sec1_bytes(&uncompressed)
            .map_err(|_| AppError::bad_request("공개 키 생성 실패"))?;

        let sig = Signature::from_der(signature)
            .map_err(|_| AppError::bad_request("DER 서명 파싱 실패"))?;

        verifying_key
            .verify(data, &sig)
            .map_err(|_| AppError::unauthorized("서명 검증 실패"))?;

        Ok(())
    }

    /// attestationObject에서 authData 추출
    fn extract_auth_data(attestation: &ciborium::Value) -> Result<Vec<u8>, AppError> {
        let map = match attestation {
            ciborium::Value::Map(m) => m,
            _ => return Err(AppError::bad_request("attestationObject가 맵이 아닙니다")),
        };

        for (key, value) in map {
            if let ciborium::Value::Text(k) = key {
                if k == "authData" {
                    if let ciborium::Value::Bytes(bytes) = value {
                        return Ok(bytes.clone());
                    }
                }
            }
        }

        Err(AppError::bad_request("authData를 찾을 수 없습니다"))
    }

    /// COSE 맵에서 정수 값 추출
    fn get_cose_int(
        map: &[(ciborium::Value, ciborium::Value)],
        label: i64,
    ) -> Result<i64, AppError> {
        for (key, value) in map {
            let key_match = match key {
                ciborium::Value::Integer(i) => {
                    let val: i128 = (*i).into();
                    val == label as i128
                }
                _ => false,
            };

            if key_match {
                return match value {
                    ciborium::Value::Integer(i) => {
                        let val: i128 = (*i).into();
                        Ok(val as i64)
                    }
                    _ => Err(AppError::bad_request("COSE 값이 정수가 아닙니다")),
                };
            }
        }

        Err(AppError::bad_request(format!(
            "COSE 키 {}를 찾을 수 없습니다",
            label
        )))
    }

    /// COSE 맵에서 바이트 값 추출
    fn get_cose_bytes(
        map: &[(ciborium::Value, ciborium::Value)],
        label: i64,
    ) -> Result<Vec<u8>, AppError> {
        for (key, value) in map {
            let key_match = match key {
                ciborium::Value::Integer(i) => {
                    let val: i128 = (*i).into();
                    val == label as i128
                }
                _ => false,
            };

            if key_match {
                return match value {
                    ciborium::Value::Bytes(b) => Ok(b.clone()),
                    _ => Err(AppError::bad_request("COSE 값이 바이트가 아닙니다")),
                };
            }
        }

        Err(AppError::bad_request(format!(
            "COSE 키 {}를 찾을 수 없습니다",
            label
        )))
    }
}
