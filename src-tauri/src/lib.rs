use axum::{body::Bytes, extract::{DefaultBodyLimit, State}, http::{HeaderMap, Method, StatusCode}, response::IntoResponse, routing::any, Router};
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pending: PendingRequests = Arc::new(Mutex::new(HashMap::new()));
    let server_running = Arc::new(AtomicBool::new(false));

    tauri::Builder::default()
        .manage(pending)
        .manage(server_running)
        .invoke_handler(tauri::generate_handler![start_http_server, http_response])
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .on_page_load(|webview, _payload| {
            // Clear orphaned state from pre-reload session
            let pending: tauri::State<'_, PendingRequests> = webview.state();
            let server_running: tauri::State<'_, Arc<AtomicBool>> = webview.state();
            let pending_clone = pending.inner().clone();
            server_running.store(false, Ordering::SeqCst);
            tauri::async_runtime::spawn(async move {
                pending_clone.lock().await.clear();
            });

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
                        location.reload();
                    } else if (e.altKey && e.key === 'ArrowLeft') {
                        e.preventDefault();
                        history.back();
                    } else if (e.altKey && e.key === 'ArrowRight') {
                        e.preventDefault();
                        history.forward();
                    }
                });
            "#);
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
