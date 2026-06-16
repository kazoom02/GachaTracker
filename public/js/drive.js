// js/drive.js
// Optional backup to a visible Google Drive file.
// Fully works once GOOGLE_CLIENT_ID is set in config.js; otherwise stays disabled.

import { GOOGLE_CLIENT_ID, DRIVE_FILENAME } from './config.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
let tokenClient = null;
let accessToken = null;
let gisReady = null;

export function driveEnabled() {
  return Boolean(GOOGLE_CLIENT_ID);
}

function loadGis() {
  if (gisReady) return gisReady;
  gisReady = new Promise((resolve, reject) => {
    if (window.google && google.accounts && google.accounts.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Google sign-in.'));
    document.head.appendChild(s);
  });
  return gisReady;
}

async function getToken() {
  if (!driveEnabled()) throw new Error('Google Drive is not configured.');
  await loadGis();
  if (!tokenClient) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: () => {}, // set per-request below
    });
  }
  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp.error) return reject(new Error(resp.error));
      accessToken = resp.access_token;
      resolve(accessToken);
    };
    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  });
}

async function findFileId(token) {
  const url =
    'https://www.googleapis.com/drive/v3/files?' +
    `q=${encodeURIComponent(`name='${DRIVE_FILENAME}' and trashed=false`)}` +
    '&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc';
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json();
  return json.files && json.files.length ? json.files[0].id : null;
}

export async function driveSave(dataObj) {
  const token = await getToken();
  const id = await findFileId(token);
  const content = JSON.stringify(dataObj);

  if (id) {
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: content,
    });
    return 'updated';
  }
  // Create a normal visible Drive file via multipart upload.
  const boundary = 'gacha' + Date.now();
  const metadata = { name: DRIVE_FILENAME };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    `${content}\r\n--${boundary}--`;
  await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return 'created';
}

export async function driveLoad() {
  const token = await getToken();
  const id = await findFileId(token);
  if (!id) return null;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}
