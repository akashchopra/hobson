use axum::{body::Bytes, extract::{DefaultBodyLimit, State}, http::{HeaderMap, Method, StatusCode}, response::IntoResponse, routing::any, Router};
use chrono::Duration;
use mailparse::MailHeaderMap;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, net::SocketAddr, sync::{atomic::{AtomicBool, Ordering}, Arc}};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::{oneshot, Mutex};
use tower_http::cors::CorsLayer;

type PendingRequests = Arc<Mutex<HashMap<String, oneshot::Sender<HttpResponsePayload>>>>;

#[derive(Clone, Serialize)]
struct HttpRequestPayload {
    #[serde(rename = "requestId")]
    request_id: String,
    method: String,
    path: String,
    body: String,
}

#[derive(Deserialize)]
struct HttpResponsePayload {
    #[serde(rename = "requestId")]
    request_id: String,
    status: u16,
    body: String,
}

#[derive(Clone)]
struct ProxyState {
    app: AppHandle,
    pending: PendingRequests,
}

async fn proxy_handler(
    State(state): State<ProxyState>,
    method: Method,
    axum::extract::Path(path): axum::extract::Path<String>,
    _headers: HeaderMap,
    body: Bytes,
) -> impl IntoResponse {
    let request_id = uuid::Uuid::new_v4().to_string();
    let body_str = String::from_utf8_lossy(&body).to_string();

    let (tx, rx) = oneshot::channel();
    state.pending.lock().await.insert(request_id.clone(), tx);

    let payload = HttpRequestPayload {
        request_id: request_id.clone(),
        method: method.to_string(),
        path: format!("/{path}"),
        body: body_str,
    };

    if state.app.emit("http-request", &payload).is_err() {
        state.pending.lock().await.remove(&request_id);
        return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to forward request".to_string());
    }

    match tokio::time::timeout(std::time::Duration::from_secs(30), rx).await {
        Ok(Ok(response)) => {
            let status = StatusCode::from_u16(response.status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
            (status, response.body)
        }
        _ => {
            state.pending.lock().await.remove(&request_id);
            (StatusCode::GATEWAY_TIMEOUT, "Request timed out".to_string())
        }
    }
}

#[tauri::command]
async fn http_response(
    state: tauri::State<'_, PendingRequests>,
    payload: HttpResponsePayload,
) -> Result<(), String> {
    if let Some(tx) = state.lock().await.remove(&payload.request_id) {
        let _ = tx.send(payload);
    }
    Ok(())
}

#[tauri::command]
async fn consume_pending_share(app: AppHandle) -> Result<Option<String>, String> {
    let path = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("pending_share.txt");
    if !path.exists() {
        return Ok(None);
    }
    let url = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    Ok(Some(url.trim().to_string()))
}

#[tauri::command]
async fn start_http_server(app: AppHandle, port: u16) -> Result<String, String> {
    let running: tauri::State<'_, Arc<AtomicBool>> = app.state();
    if running.swap(true, Ordering::SeqCst) {
        return Ok("HTTP server already running".to_string());
    }

    let pending: PendingRequests = app.state::<PendingRequests>().inner().clone();

    let state = ProxyState {
        app: app.clone(),
        pending,
    };

    let router = Router::new()
        .route("/{*path}", any(proxy_handler))
        .layer(DefaultBodyLimit::max(64 * 1024 * 1024)) // 64MB
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    let running_flag = running.inner().clone();
    tokio::spawn(async move {
        let listener = match tokio::net::TcpListener::bind(addr).await {
            Ok(l) => l,
            Err(e) => {
                running_flag.store(false, Ordering::SeqCst);
                eprintln!("Failed to bind HTTP server: {e}");
                return;
            }
        };
        if let Err(e) = axum::serve(listener, router).await {
            running_flag.store(false, Ordering::SeqCst);
            eprintln!("HTTP server error: {e}");
        }
    });

    Ok(format!("HTTP server listening on 0.0.0.0:{port}"))
}

#[derive(Deserialize)]
struct EmailAccount {
    host: String,
    port: u16,
    username: String,
    password: String,
    folder: String,
}

#[derive(Serialize)]
struct EmailHeader {
    uid: u32,
    from: String,
    subject: String,
    date: String,
}

#[derive(Serialize)]
struct EmailAttachment {
    name: String,
    mime_type: String,
    data: String,
}

#[derive(Serialize)]
struct EmailBody {
    html: Option<String>,
    text: Option<String>,
    to: String,
    attachments: Vec<EmailAttachment>,
}

struct BodyState {
    text: Option<String>,
    html: Option<String>,
    inline_images: Vec<(String, String)>,
    attachments: Vec<EmailAttachment>,
}


fn get_as_base64(part: &mailparse::ParsedMail) -> String {
    use base64::{Engine, engine::general_purpose::STANDARD};
    STANDARD.encode(&part.get_body_raw().unwrap_or_default())
}

fn extract_filename(part: &mailparse::ParsedMail) -> String {
    if let Some(name) = part.ctype.params.get("name") {
        return name.clone();
    }
    let disp = part.headers.get_first_value("Content-Disposition")
        .unwrap_or_default();
    for param in disp.split(';') {
        let param = param.trim();
        if let Some(val) = param.strip_prefix("filename=") {
            let val = val.trim().trim_matches('"');
            if !val.is_empty() { return val.to_string(); }
        }
    }
    "attachment".to_string()
}

fn collect_parts(part: &mailparse::ParsedMail, state: &mut BodyState) {
    let mime = part.ctype.mimetype.to_lowercase();
    if mime.starts_with("multipart/") {
        for subpart in &part.subparts {
            collect_parts(subpart, state);
        }
        return;
    }
    let disposition = part.headers.get_first_value("Content-Disposition")
        .unwrap_or_default().to_lowercase();
    let cid = part.headers.get_first_value("Content-ID")
        .unwrap_or_default();
    let cid = cid.trim_matches(|c: char| c == '<' || c == '>').to_string();
    let is_attachment = disposition.starts_with("attachment");
    if !is_attachment && mime == "text/plain" && state.text.is_none() {
        state.text = Some(part.get_body().unwrap_or_default());
    } else if !is_attachment && mime == "text/html" && state.html.is_none() {
        state.html = Some(part.get_body().unwrap_or_default());
    } else if !cid.is_empty() && !is_attachment {
        let b64 = get_as_base64(part);
        state.inline_images.push((cid, format!("data:{};base64,{}", mime, b64)));
    } else if is_attachment || (!mime.starts_with("text/") && !mime.starts_with("multipart/")) {
        state.attachments.push(EmailAttachment {
            name: extract_filename(part),
            mime_type: mime,
            data: get_as_base64(part),
        });
    }
}

fn with_imap_session<F, T>(account: &EmailAccount, f: F) -> Result<T, String>
where
    F: FnOnce(&mut imap::Session<native_tls::TlsStream<std::net::TcpStream>>) -> Result<T, String>,
{
    let tls = native_tls::TlsConnector::builder().build().map_err(|e| e.to_string())?;
    let client = imap::connect((account.host.as_str(), account.port), &account.host, &tls)
        .map_err(|e| e.to_string())?;
    let mut session = client.login(&account.username, &account.password)
        .map_err(|(e, _)| e.to_string())?;
    session.select(&account.folder).map_err(|e| e.to_string())?;
    let result = f(&mut session);
    session.logout().ok();
    result
}

#[tauri::command]
async fn fetch_email_headers(account: EmailAccount, since_days: u32) -> Result<Vec<EmailHeader>, String> {
    tokio::task::spawn_blocking(move || {
        with_imap_session(&account, |session| {
            let since = (chrono::Utc::now() - Duration::days(since_days as i64))
                .format("%-d-%b-%Y").to_string();
            let uids: Vec<u32> = session.uid_search(format!("SINCE {since}"))
                .map_err(|e| e.to_string())?.into_iter().collect();
            if uids.is_empty() { return Ok(vec![]); }
            let uid_set = uids.iter().map(|u| u.to_string()).collect::<Vec<_>>().join(",");
            let messages = session.uid_fetch(&uid_set, "RFC822.HEADER").map_err(|e| e.to_string())?;
            Ok(messages.iter().filter_map(|msg| {
                let uid = msg.uid?;
                let raw_headers = msg.header()?;
                let (headers, _) = mailparse::parse_headers(raw_headers).ok()?;
                let from = headers.get_first_value("From").unwrap_or_default();
                let subject = headers.get_first_value("Subject").unwrap_or_default();
                let date = headers.get_first_value("Date").unwrap_or_default();
                Some(EmailHeader { uid, from, subject, date })
            }).collect())
        })
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn list_folders(account: EmailAccount) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        let tls = native_tls::TlsConnector::builder().build().map_err(|e| e.to_string())?;
        let client = imap::connect((account.host.as_str(), account.port), &account.host, &tls)
            .map_err(|e| e.to_string())?;
        let mut session = client.login(&account.username, &account.password)
            .map_err(|(e, _)| e.to_string())?;
        let mailboxes = session.list(None, Some("*")).map_err(|e| e.to_string())?;
        let mut names: Vec<String> = mailboxes.iter().map(|m| m.name().to_string()).collect();
        names.sort();
        session.logout().ok();
        Ok(names)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn fetch_email_body(account: EmailAccount, uid: u32) -> Result<EmailBody, String> {
    tokio::task::spawn_blocking(move || {
        with_imap_session(&account, |session| {
            let messages = session.uid_fetch(uid.to_string(), "BODY[]")
                .map_err(|e| e.to_string())?;
            let raw = messages.iter().next()
                .and_then(|m| m.body())
                .ok_or_else(|| "No body found".to_string())?;
            let parsed = mailparse::parse_mail(raw).map_err(|e| e.to_string())?;
            let to = parsed.headers.get_first_value("To")
                .unwrap_or_default();
            let mut state = BodyState {
                text: None,
                html: None,
                inline_images: Vec::new(),
                attachments: Vec::new(),
            };
            collect_parts(&parsed, &mut state);
            let html = state.html.map(|mut h| {
                for (cid, data_uri) in &state.inline_images {
                    h = h.replace(&format!("cid:{}", cid), data_uri);
                }
                h
            });
            Ok(EmailBody { html, text: state.text, to, attachments: state.attachments })
        })
    }).await.map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pending: PendingRequests = Arc::new(Mutex::new(HashMap::new()));
    let server_running = Arc::new(AtomicBool::new(false));

    tauri::Builder::default()
        .manage(pending)
        .manage(server_running)
        .invoke_handler(tauri::generate_handler![start_http_server, http_response, consume_pending_share,
            fetch_email_headers, fetch_email_body, list_folders])
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .on_page_load(|webview, payload| {
            // Clear orphaned state from pre-reload session — runs on Started so
            // pending HTTP requests are cancelled before the new page boots.
            if payload.event() == tauri::webview::PageLoadEvent::Started {
                let pending: tauri::State<'_, PendingRequests> = webview.state();
                let server_running: tauri::State<'_, Arc<AtomicBool>> = webview.state();
                let pending_clone = pending.inner().clone();
                server_running.store(false, Ordering::SeqCst);
                tauri::async_runtime::spawn(async move {
                    pending_clone.lock().await.clear();
                });
            }

            // Inject keyboard handlers only on Finished (new JS context is ready).
            // Injecting on Started risks landing in the old context, which accumulates
            // extra Ctrl+R handlers across rapid reloads and can cause a reload storm.
            if payload.event() == tauri::webview::PageLoadEvent::Finished {
                let _ = webview.eval(r#"
                    document.addEventListener('keydown', e => {
                        // Prevent WebKitGTK from consuming Ctrl+ shortcuts
                        // Allow clipboard operations (Ctrl+C/V/X/A) to keep native behavior
                        if (e.ctrlKey && !e.altKey) {
                            const allow = ['c','v','x','a','f'].includes(e.key.toLowerCase());
                            if (!allow) e.preventDefault();
                        }
                    }, { capture: true });
                    document.addEventListener('keydown', e => {
                        if ((e.ctrlKey && e.key === 'r') || e.key === 'F5') {
                            e.preventDefault();
                            // Guard against concurrent reloads: WebKitGTK processes each
                            // location.reload() call as a separate navigation, so two rapid
                            // Ctrl+Rs spawn two concurrent boot sequences that compete over
                            // shared IndexedDB and cause runaway memory growth.
                            if (!window.__hobsonReloading) {
                                window.__hobsonReloading = true;
                                location.reload();
                            }
                        } else if (e.altKey && e.key === 'ArrowLeft') {
                            e.preventDefault();
                            history.back();
                        } else if (e.altKey && e.key === 'ArrowRight') {
                            e.preventDefault();
                            history.forward();
                        }
                    });
                "#);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
