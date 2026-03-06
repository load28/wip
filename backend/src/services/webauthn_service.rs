use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

use webauthn_rs::prelude::*;
use webauthn_rs::Webauthn;

use crate::config::Config;

const CHALLENGE_TTL_SECS: u64 = 300;

pub struct WebAuthnService {
    pub webauthn: Webauthn,
    reg_states: Mutex<HashMap<String, (PasskeyRegistration, Instant)>>,
    auth_states: Mutex<HashMap<String, (DiscoverableAuthentication, Instant)>>,
}

impl WebAuthnService {
    pub fn new(config: &Config) -> Self {
        let rp_origin =
            Url::parse(&config.webauthn_rp_origin).expect("Invalid WEBAUTHN_RP_ORIGIN URL");

        let builder = WebauthnBuilder::new(&config.webauthn_rp_id, &rp_origin)
            .expect("Invalid WebAuthn configuration")
            .rp_name("Wip Task Manager");

        let webauthn = builder.build().expect("Failed to build WebAuthn");

        Self {
            webauthn,
            reg_states: Mutex::new(HashMap::new()),
            auth_states: Mutex::new(HashMap::new()),
        }
    }

    pub fn store_registration(&self, user_id: &str, state: PasskeyRegistration) {
        let mut states = self.reg_states.lock().unwrap();
        states.retain(|_, (_, created)| created.elapsed().as_secs() < CHALLENGE_TTL_SECS);
        states.insert(user_id.to_string(), (state, Instant::now()));
    }

    pub fn take_registration(&self, user_id: &str) -> Option<PasskeyRegistration> {
        let mut states = self.reg_states.lock().unwrap();
        states.remove(user_id).and_then(|(state, created)| {
            if created.elapsed().as_secs() < CHALLENGE_TTL_SECS {
                Some(state)
            } else {
                None
            }
        })
    }

    pub fn store_authentication(&self, session_id: &str, state: DiscoverableAuthentication) {
        let mut states = self.auth_states.lock().unwrap();
        states.retain(|_, (_, created)| created.elapsed().as_secs() < CHALLENGE_TTL_SECS);
        states.insert(session_id.to_string(), (state, Instant::now()));
    }

    pub fn take_authentication(&self, session_id: &str) -> Option<DiscoverableAuthentication> {
        let mut states = self.auth_states.lock().unwrap();
        states.remove(session_id).and_then(|(state, created)| {
            if created.elapsed().as_secs() < CHALLENGE_TTL_SECS {
                Some(state)
            } else {
                None
            }
        })
    }
}
